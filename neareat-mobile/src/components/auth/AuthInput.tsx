import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, TextInputProps, ViewStyle,
} from 'react-native';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';
import AppIcon from '../AppIcon';
import type { IconName } from '../../theme/icons';

interface Props extends TextInputProps {
  /** Baş ikon (semantik ad). */
  icon: IconName;
  label?: string;
  /** Şifre alanı — göz aç/kapat düğmesi gösterir, secureTextEntry yönetir. */
  isPassword?: boolean;
  error?: string | null;
  containerStyle?: ViewStyle;
}

/**
 * Premium auth input — baş ikon + focus'ta coral çerçeve + opsiyonel şifre göz toggle + hata.
 * Tüm onboarding/auth ekranlarında ortak kullanılır.
 */
export default function AuthInput({
  icon, label, isPassword, error, containerStyle,
  multiline, style, onFocus, onBlur, ...rest
}: Props) {
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const [focused, setFocused] = useState(false);
  const [show, setShow] = useState(false);
  const hasError = !!error;

  const iconColor = hasError ? C.error : focused ? C.primary : C.textTertiary;

  return (
    <View style={[styles.field, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[
        styles.wrap,
        multiline && styles.wrapMulti,
        focused && styles.wrapFocus,
        hasError && styles.wrapError,
      ]}>
        <AppIcon name={icon} size={18} color={iconColor} style={multiline ? styles.iconTop : undefined} />
        <TextInput
          style={[styles.input, multiline && styles.inputMulti, style]}
          placeholderTextColor={C.textMuted}
          secureTextEntry={isPassword && !show}
          multiline={multiline}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          {...rest}
        />
        {isPassword ? (
          <TouchableOpacity style={styles.eyeBtn} onPress={() => setShow(s => !s)} hitSlop={8}>
            <AppIcon name={show ? 'eyeOff' : 'eye'} size={20} color={C.textTertiary} />
          </TouchableOpacity>
        ) : null}
      </View>
      {hasError ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    field: { marginTop: 14 },
    label: { fontSize: 13, fontWeight: '600', color: C.textSecondary, marginBottom: 7 },
    wrap: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: 'transparent',
      borderRadius: 12, paddingHorizontal: 14,
    },
    wrapMulti: { alignItems: 'flex-start' },
    wrapFocus: { borderColor: C.primary, backgroundColor: C.surface },
    wrapError: { borderColor: C.error },
    input: { flex: 1, paddingVertical: 13, fontSize: 15, color: C.textPrimary },
    inputMulti: { minHeight: 76, textAlignVertical: 'top', paddingTop: 12 },
    iconTop: { marginTop: 15 },
    eyeBtn: { paddingLeft: 8, paddingVertical: 8 },
    errorText: { fontSize: 12, color: C.error, marginTop: 5 },
  });
}
