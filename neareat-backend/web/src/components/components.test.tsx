import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Button } from './Button';
import { Field, PasswordInput } from './Field';
import { Dialog } from './Dialog';
import { DataTable } from './DataTable';
import { Tabs } from './Tabs';
import { Alert, EmptyState, Skeleton, StatusBadge, ToastRegion } from './Feedback';
import { ThemeToggle } from './ThemeToggle';
import { toast } from '../store/toastStore';
import { act } from 'react';

describe('Button', () => {
  it('yükleniyorken ikinci tıklama işlem tetiklemez', () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Kaydet</Button>);
    fireEvent.click(screen.getByRole('button'));
    rerender(<Button onClick={onClick} loading>Kaydet</Button>);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  });
  it('yükleniyorken submit formu göndermez', () => {
    const onSubmit = vi.fn((e) => e.preventDefault());
    render(<form onSubmit={onSubmit}><Button type="submit" loading>Gönder</Button></form>);
    fireEvent.click(screen.getByRole('button'));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('Field', () => {
  it('hata aria-invalid + aria-describedby ile bağlanır', () => {
    render(<Field id="f" label="E-posta" hint="ipucu" error="Hatalı"><input className="input" /></Field>);
    const input = screen.getByLabelText('E-posta');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toContain('f-err');
    expect(screen.getByText('Hatalı')).toHaveAttribute('id', 'f-err');
  });
  it('hatasız alan aria-invalid taşımaz', () => {
    render(<Field id="g" label="Ad"><input /></Field>);
    expect(screen.getByLabelText('Ad')).not.toHaveAttribute('aria-invalid');
  });
  it('şifre göster/gizle', () => {
    render(<Field id="p" label="Şifre"><PasswordInput /></Field>);
    const input = screen.getByLabelText('Şifre');
    expect(input).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'Şifreyi göster' }));
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Şifreyi gizle' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('Dialog', () => {
  it('açılır, başlığa bağlanır, Esc (cancel) kapatır', () => {
    const onClose = vi.fn();
    const { rerender } = render(<Dialog open={false} title="Onayla" onClose={onClose}>İçerik</Dialog>);
    expect(screen.queryByText('İçerik')).toBeNull();
    rerender(<Dialog open title="Onayla" onClose={onClose}>İçerik</Dialog>);
    const dlg = document.querySelector('dialog')!;
    expect(dlg).toHaveAttribute('open');
    expect(dlg.getAttribute('aria-labelledby')).toBe(screen.getByText('Onayla').id);
    fireEvent(dlg, new Event('cancel', { cancelable: true }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('DataTable', () => {
  it('kart görünümü için data-label, ilk hücre cell-primary, caption', () => {
    render(<DataTable caption="Liste" rows={[{ id: '1', n: 'Ali', k: 4 }]} rowKey={(r) => r.id}
      columns={[{ key: 'n', header: 'Misafir', render: (r) => r.n }, { key: 'k', header: 'Kişi', render: (r) => r.k }]}
      actions={() => <button>Onayla</button>} />);
    expect(document.querySelector('table')).toHaveClass('table-stack');
    expect(screen.getByText('Ali').closest('td')).toHaveClass('cell-primary');
    expect(screen.getByText('4').closest('td')).toHaveAttribute('data-label', 'Kişi');
    expect(screen.getByText('Onayla').closest('td')).toHaveClass('cell-actions');
    expect(screen.getByText('Liste').tagName).toBe('CAPTION');
  });
});

describe('Tabs', () => {
  it('ok tuşlarıyla gezilir', () => {
    const onChange = vi.fn();
    render(<Tabs label="Filtre" value="A" onChange={onChange} items={[{ key: 'A', label: 'Bir', count: 1 }, { key: 'B', label: 'İki' }]} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('tabindex', '-1');
    fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('B');
    fireEvent.keyDown(tabs[0], { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith('B');
  });
});

describe('geri bildirim bileşenleri', () => {
  it('Alert rolü tona göre', () => {
    render(<><Alert tone="danger" title="Hata" /><Alert tone="info" title="Bilgi" /></>);
    expect(screen.getByRole('alert')).toHaveTextContent('Hata');
    expect(screen.getByRole('status')).toHaveTextContent('Bilgi');
  });
  it('EmptyState, Skeleton, StatusBadge', () => {
    render(<><EmptyState title="Boş">Açıklama</EmptyState><Skeleton /><StatusBadge tone="priority">Öncelikli</StatusBadge></>);
    expect(screen.getByRole('heading', { name: 'Boş' })).toBeInTheDocument();
    expect(document.querySelector('.skeleton')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Öncelikli')).toHaveClass('badge', 'badge-priority');
  });
  it('Toast gösterilir', () => {
    render(<ToastRegion />);
    act(() => toast('Kaydedildi', 'success'));
    expect(screen.getByText('Kaydedildi').closest('.toast')).toHaveAttribute('role', 'status');
  });
});

describe('ThemeToggle', () => {
  it('temayı değiştirir ve saklar; depolama hatasında çökmez', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    render(<ThemeToggle />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    spy.mockRestore();
  });
});
