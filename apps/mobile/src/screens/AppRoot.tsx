import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { RpgIntroScreen } from './RpgIntroScreen';
import { DndWebApp } from '../components/DndWebApp';
import { isIntroComplete, markIntroComplete } from '../lib/introStorage';
import { colors } from '../theme';

type Gate = 'boot' | 'intro' | 'app';

export function AppRoot() {
  const [gate, setGate] = useState<Gate>('boot');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const done = await isIntroComplete();
      if (!cancelled) setGate(done ? 'app' : 'intro');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const finishIntro = useCallback(async () => {
    await markIntroComplete();
    setGate('app');
  }, []);

  if (gate === 'boot') {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  if (gate === 'intro') {
    return <RpgIntroScreen onComplete={finishIntro} />;
  }

  return <DndWebApp />;
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: colors.void,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
