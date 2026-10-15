import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { INTRO_SLIDES } from '../data/realms';
import { colors, fonts } from '../theme';

type Props = {
  index: number;
  onNext: () => void;
  onSkip: () => void;
  isLast: boolean;
};

export function IntroSlidePanel({ index, onNext, onSkip, isLast }: Props) {
  const slide = INTRO_SLIDES[index];
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    opacity.setValue(0);
    translateX.setValue(24);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration: 420,
        useNativeDriver: true,
      }),
    ]).start();
  }, [index, opacity, translateX]);

  return (
    <Animated.View
      style={[styles.panel, { opacity, transform: [{ translateX }] }]}
    >
      <View style={styles.content}>
        <Text style={styles.kicker}>Próximo capítulo</Text>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>
      </View>

      <View style={styles.dots}>
        {INTRO_SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.actions}>
        <Pressable onPress={onSkip} hitSlop={12}>
          <Text style={styles.skip}>Pular</Text>
        </Pressable>
        <Pressable style={styles.primary} onPress={onNext}>
          <Text style={styles.primaryText}>{isLast ? 'Entrar na taverna' : 'Continuar'}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 28,
    paddingBottom: 48,
  },
  content: {
    marginBottom: 32,
  },
  kicker: {
    fontSize: fonts.label,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.goldDim,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  body: {
    fontSize: fonts.body,
    lineHeight: 24,
    color: colors.textMuted,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(201, 162, 39, 0.25)',
  },
  dotActive: {
    backgroundColor: colors.gold,
    width: 24,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skip: {
    color: colors.textMuted,
    fontSize: fonts.body,
  },
  primary: {
    backgroundColor: colors.gold,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 8,
  },
  primaryText: {
    color: colors.void,
    fontWeight: '700',
    fontSize: fonts.body,
  },
});
