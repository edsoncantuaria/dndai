import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { Starfield } from '../components/Starfield';
import { RealmIntroSelector } from '../components/RealmIntroSelector';
import { IntroSlidePanel } from '../components/IntroSlidePanel';
import { INTRO_SLIDES } from '../data/realms';
import type { RealmId } from '../data/realms';
import { colors } from '../theme';

type Phase = 'explorer' | 'slides';

export interface RpgIntroScreenProps {
  onComplete: () => void;
}

export function RpgIntroScreen({ onComplete }: RpgIntroScreenProps) {
  const [phase, setPhase] = useState<Phase>('explorer');
  const [selectedRealm, setSelectedRealm] = useState<RealmId>('wizard');
  const [slideIndex, setSlideIndex] = useState(0);

  const goToSlides = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase('slides');
  };

  const advanceSlide = () => {
    if (slideIndex >= INTRO_SLIDES.length - 1) {
      onComplete();
      return;
    }
    setSlideIndex((i) => i + 1);
  };

  const skipToApp = () => onComplete();

  const ctaOpacity = useRef(new Animated.Value(0)).current;
  const ctaY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    if (phase !== 'explorer') return;
    ctaOpacity.setValue(0);
    ctaY.setValue(16);
    Animated.parallel([
      Animated.timing(ctaOpacity, {
        toValue: 1,
        duration: 700,
        delay: 400,
        useNativeDriver: true,
      }),
      Animated.timing(ctaY, {
        toValue: 0,
        duration: 700,
        delay: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [phase, ctaOpacity, ctaY]);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[colors.void, colors.voidMid, '#1a1028', colors.void]}
        locations={[0, 0.45, 0.75, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Starfield />

      {phase === 'explorer' && (
        <>
          <RealmIntroSelector selectedId={selectedRealm} onSelect={setSelectedRealm} />
          <Animated.View
            style={[styles.ctaBar, { opacity: ctaOpacity, transform: [{ translateY: ctaY }] }]}
          >
            <Pressable style={styles.cta} onPress={goToSlides}>
              <Text style={styles.ctaText}>Explorar o reino</Text>
            </Pressable>
          </Animated.View>
        </>
      )}

      {phase === 'slides' && (
        <IntroSlidePanel
          index={slideIndex}
          onNext={advanceSlide}
          onSkip={skipToApp}
          isLast={slideIndex === INTRO_SLIDES.length - 1}
        />
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.void,
  },
  ctaBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 28,
    paddingBottom: 40,
    paddingTop: 12,
  },
  cta: {
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: colors.gold,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(201, 162, 39, 0.12)',
  },
  ctaText: {
    color: colors.gold,
    fontWeight: '600',
    fontSize: 15,
    letterSpacing: 0.5,
  },
});
