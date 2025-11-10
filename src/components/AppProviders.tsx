'use client';

import { SettingsProvider } from '@/contexts/SettingsContext';
import { AuthProvider } from '@/contexts/AuthContext';
import type { ReactNode } from 'react';

interface AppProvidersProps {
  children: ReactNode;
}

const AppProviders = ({ children }: AppProvidersProps) => (
  <SettingsProvider>
    <AuthProvider>{children}</AuthProvider>
  </SettingsProvider>
);

export default AppProviders;
