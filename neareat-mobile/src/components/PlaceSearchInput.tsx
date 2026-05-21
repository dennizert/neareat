import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
} from 'react-native';
import { useTheme } from '../theme';
import type { Colors } from '../theme';
import { searchPlaces } from '../data/turkishPlaces';
import type { TurkishPlace } from '../data/turkishPlaces';

interface Props {
  label: string;
  value: TurkishPlace | null;
  onChange: (place: TurkishPlace | null) => void;
  placeholder?: string;
}

export default function PlaceSearchInput({ label, value, onChange, placeholder }: Props) {
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const [text, setText] = useState('');
  const [results, setResults] = useState<TurkishPlace[]>([]);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleChange = useCallback((val: string) => {
    setText(val);
    if (value) onChange(null);
    if (val.length >= 3) {
      setResults(searchPlaces(val));
    } else {
      setResults([]);
    }
  }, [value, onChange]);

  const handleSelect = useCallback((place: TurkishPlace) => {
    onChange(place);
    setText(place.type === 'ilce' ? `${place.name} (${place.province})` : place.name);
    setResults([]);
    inputRef.current?.blur();
  }, [onChange]);

  const handleClear = useCallback(() => {
    onChange(null);
    setText('');
    setResults([]);
    inputRef.current?.focus();
  }, [onChange]);

  const showDropdown = focused && results.length > 0 && !value;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, focused && styles.inputRowFocused, value && styles.inputRowFilled]}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={text}
          onChangeText={handleChange}
          placeholder={placeholder ?? `${label} ara...`}
          placeholderTextColor={C.placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            // Kısa delay — dropdown tap'ın önünde kapanmasın
            setTimeout(() => setFocused(false), 150);
          }}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {(text.length > 0 || value) && (
          <TouchableOpacity onPress={handleClear} style={styles.clearBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.clearIcon}>×</Text>
          </TouchableOpacity>
        )}
        {value && <Text style={styles.checkIcon}>✓</Text>}
      </View>

      {showDropdown && (
        <View style={styles.dropdown}>
          <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {results.map((place) => (
              <TouchableOpacity
                key={place.id}
                style={styles.dropdownItem}
                onPress={() => handleSelect(place)}
                activeOpacity={0.7}
              >
                <View style={styles.dropdownItemInner}>
                  <Text style={styles.dropdownName}>{place.name}</Text>
                  {place.type === 'ilce' && (
                    <Text style={styles.dropdownProvince}>{place.province}</Text>
                  )}
                </View>
                <Text style={styles.dropdownType}>{place.type === 'il' ? 'İl' : 'İlçe'}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    wrapper: { marginBottom: 12 },

    label: {
      fontSize: 11, fontWeight: '700', color: C.textTertiary,
      letterSpacing: 0.5, marginBottom: 6, textTransform: 'uppercase',
    },

    inputRow: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: C.inputBg, borderRadius: 12,
      borderWidth: 1.5, borderColor: C.border,
      paddingHorizontal: 12,
    },
    inputRowFocused: { borderColor: C.primary },
    inputRowFilled: { borderColor: C.success },

    input: {
      flex: 1, height: 46, fontSize: 15,
      color: C.textPrimary,
    },

    clearBtn: { paddingLeft: 4 },
    clearIcon: { fontSize: 20, color: C.textMuted, lineHeight: 24 },
    checkIcon: { fontSize: 16, color: C.success, marginLeft: 4 },

    dropdown: {
      backgroundColor: C.surface, borderRadius: 12,
      borderWidth: 1, borderColor: C.border,
      maxHeight: 240,
      shadowColor: C.shadow, shadowOpacity: 0.1, shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 }, elevation: 6,
      zIndex: 100,
    },

    dropdownItem: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 14, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: C.separator,
    },
    dropdownItemInner: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
    dropdownName: { fontSize: 15, fontWeight: '600', color: C.textPrimary },
    dropdownProvince: { fontSize: 13, color: C.textTertiary },
    dropdownType: {
      fontSize: 11, color: C.primary, fontWeight: '700',
      textTransform: 'uppercase', letterSpacing: 0.3,
    },
  });
}
