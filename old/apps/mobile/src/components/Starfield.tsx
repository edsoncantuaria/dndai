import { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';
import { colors } from '../theme';

const { width, height } = Dimensions.get('window');

type Star = { x: number; y: number; size: number; opacity: number; layer: 0 | 1 | 2 };

function seedStars(count: number): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() > 0.92 ? 2.2 : 1,
      opacity: 0.25 + Math.random() * 0.75,
      layer: (i % 3) as 0 | 1 | 2,
    });
  }
  return stars;
}

const DRIFT = [12, 28, 48];

function DriftLayer({
  stars,
  layerIndex,
  drift,
}: {
  stars: Star[];
  layerIndex: number;
  drift: Animated.Value;
}) {
  const translateY = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [0, DRIFT[layerIndex]],
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY }] }]}>
      {stars
        .filter((s) => s.layer === layerIndex)
        .map((star, i) => (
          <View
            key={`${layerIndex}-${i}`}
            style={[
              styles.star,
              {
                left: star.x,
                top: star.y,
                width: star.size,
                height: star.size,
                opacity: star.opacity,
              },
            ]}
          />
        ))}
    </Animated.View>
  );
}

export function Starfield() {
  const stars = useMemo(() => seedStars(120), []);
  const drift0 = useRef(new Animated.Value(0)).current;
  const drift1 = useRef(new Animated.Value(0)).current;
  const drift2 = useRef(new Animated.Value(0)).current;
  const drifts = [drift0, drift1, drift2];

  useEffect(() => {
    const loops = drifts.map((d) =>
      Animated.loop(
        Animated.timing(d, {
          toValue: 1,
          duration: 48000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [drift0, drift1, drift2]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {drifts.map((drift, i) => (
        <DriftLayer key={i} stars={stars} layerIndex={i} drift={drift} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  star: {
    position: 'absolute',
    borderRadius: 99,
    backgroundColor: colors.text,
  },
});
