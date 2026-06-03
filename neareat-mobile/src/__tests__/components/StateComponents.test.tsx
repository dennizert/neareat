import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import Skeleton, { SkeletonCard } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';

// S11-3 — Skeleton + EmptyState + ErrorState

describe('Skeleton', () => {
  it('çökmeden render eder', () => {
    expect(() => render(<Skeleton width={120} height={20} />)).not.toThrow();
  });
  it('SkeletonCard render eder', () => {
    expect(() => render(<SkeletonCard />)).not.toThrow();
  });
});

describe('EmptyState', () => {
  it('başlık ve açıklamayı gösterir', () => {
    render(<EmptyState title="Henüz favori yok" description="Beğendiğin mekanları favorile" />);
    expect(screen.getByText('Henüz favori yok')).toBeTruthy();
    expect(screen.getByText('Beğendiğin mekanları favorile')).toBeTruthy();
  });

  it('actionLabel\'a basınca onAction çağrılır', () => {
    const onAction = jest.fn();
    render(<EmptyState title="Boş" actionLabel="Keşfet" onAction={onAction} />);
    fireEvent.press(screen.getByText('Keşfet'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('aksiyon verilmezse buton render edilmez', () => {
    render(<EmptyState title="Boş" />);
    expect(screen.queryByText('Keşfet')).toBeNull();
  });
});

describe('ErrorState', () => {
  it('varsayılan mesaj + Tekrar dene gösterir', () => {
    render(<ErrorState onRetry={() => {}} />);
    expect(screen.getByText(/ters gitti/i)).toBeTruthy();
    expect(screen.getByText('Tekrar dene')).toBeTruthy();
  });

  it('Tekrar dene\'ye basınca onRetry çağrılır', () => {
    const onRetry = jest.fn();
    render(<ErrorState message="Bağlantı yok" onRetry={onRetry} />);
    expect(screen.getByText('Bağlantı yok')).toBeTruthy();
    fireEvent.press(screen.getByText('Tekrar dene'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
