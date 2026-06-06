import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { REALMS, type RealmId } from '../data/realms';
import { colors, fonts } from '../theme';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = Math.min(300, SCREEN_W - 48);
const CARD_GAP = 16;
const CARD_STRIDE = CARD_W + CARD_GAP;
const ORBIT_W = SCREEN_W - 56;
const ORBIT_H = 140;

type Props = {
  selectedId: RealmId;
  onSelect: (id: RealmId) => void;
};

export function RealmIntroSelector({ selectedId, onSelect }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const spin = useRef(new Animated.Value(0)).current;
  const [activeIndex, setActiveIndex] = useState(
    () => REALMS.findIndex((r) => r.id === selectedId) || 0,
  );

  const selected = REALMS[activeIndex] ?? REALMS[0];

  useEffect(() => {
    const idx = REALMS.findIndex((r) => r.id === selectedId);
    if (idx >= 0 && idx !== activeIndex) {
      setActiveIndex(idx);
      scrollRef.current?.scrollTo({ x: idx * CARD_STRIDE, animated: true });
    }
  }, [selectedId]);

  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 36000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [spin]);

  const ringRotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / CARD_STRIDE);
    const clamped = Math.max(0, Math.min(REALMS.length - 1, idx));
    if (clamped !== activeIndex) {
      setActiveIndex(clamped);
      Haptics.selectionAsync();
      onSelect(REALMS[clamped].id);
    }
  };

  const pickRealm = (index: number) => {
    setActiveIndex(index);
    onSelect(REALMS[index].id);
    scrollRef.current?.scrollTo({ x: index * CARD_STRIDE, animated: true });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.logo}>Crônicas</Text>
        <Text style={styles.logoSub}>de Aventuras</Text>
      </View>

      <View style={[styles.orbitBox, { width: ORBIT_W, height: ORBIT_H }]}>
        <View style={styles.orbitEllipse} />
        <View style={[styles.orbitEllipse, styles.orbitEllipseInner]} />
        <View style={styles.orbitCore}>
          <LinearGradient
            colors={['rgba(201,162,39,0.35)', 'rgba(18,12,31,0.9)']}
            style={styles.orbitCoreGrad}
          >
            <MaterialCommunityIcons name="dice-d20" size={32} color={colors.gold} />
          </LinearGradient>
        </View>
        <Animated.View style={[styles.orbitDots, { transform: [{ rotate: ringRotate }] }]}>
          {REALMS.map((realm, index) => {
            const angle = (index / REALMS.length) * Math.PI * 2 - Math.PI / 2;
            const x = Math.cos(angle) * (ORBIT_W * 0.42);
            const y = Math.sin(angle) * (ORBIT_H * 0.38);
            const isActive = index === activeIndex;
            return (
              <Pressable
                key={realm.id}
                onPress={() => pickRealm(index)}
                style={[
                  styles.orbitDot,
                  {
                    transform: [{ translateX: x }, { translateY: y }],
                    backgroundColor: isActive ? realm.color : 'rgba(30,24,40,0.95)',
                    borderColor: isActive ? realm.color : 'rgba(255,255,255,0.15)',
                    opacity: isActive ? 1 : 0.65,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={realm.icon}
                  size={isActive ? 18 : 14}
                  color={isActive ? colors.void : colors.textMuted}
                />
              </Pressable>
            );
          })}
        </Animated.View>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_STRIDE}
        decelerationRate="fast"
        contentContainerStyle={styles.carousel}
        onMomentumScrollEnd={onScrollEnd}
      >
        {REALMS.map((realm) => {
          const isActive = realm.id === selected.id;
          return (
            <Pressable
              key={realm.id}
              onPress={() => pickRealm(REALMS.indexOf(realm))}
              style={[styles.card, { width: CARD_W, opacity: isActive ? 1 : 0.72 }]}
            >
              <LinearGradient
                colors={[`${realm.color}44`, 'rgba(8,6,14,0.95)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cardGrad}
              >
                <View style={[styles.cardIconRing, { borderColor: realm.color }]}>
                  <MaterialCommunityIcons name={realm.icon} size={36} color={realm.color} />
                </View>
                <Text style={styles.cardKicker}>{realm.orbitLabel}</Text>
                <Text style={styles.cardTitle}>{realm.name}</Text>
                <Text style={styles.cardBody}>{realm.tagline}</Text>
              </LinearGradient>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.dots}>
        {REALMS.map((realm, i) => (
          <Pressable
            key={realm.id}
            onPress={() => pickRealm(i)}
            style={[styles.dot, i === activeIndex && { backgroundColor: realm.color, width: 20 }]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingTop: 48,
  },
  header: {
    alignItems: 'center',
    marginBottom: 8,
  },
  logo: {
    fontSize: fonts.title,
    fontWeight: '700',
    color: colors.gold,
    letterSpacing: 1,
  },
  logoSub: {
    fontSize: fonts.subtitle,
    color: colors.textMuted,
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  orbitBox: {
    alignSelf: 'center',
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitEllipse: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(201, 162, 39, 0.2)',
  },
  orbitEllipseInner: {
    width: '72%',
    height: '72%',
    borderColor: 'rgba(124, 92, 255, 0.15)',
  },
  orbitCore: {
    zIndex: 2,
  },
  orbitCoreGrad: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.goldDim,
  },
  orbitDots: {
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitDot: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -18,
    marginTop: -18,
  },
  carousel: {
    paddingHorizontal: (SCREEN_W - CARD_W) / 2,
    gap: CARD_GAP,
    paddingBottom: 8,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(201, 162, 39, 0.2)',
  },
  cardGrad: {
    padding: 22,
    minHeight: 200,
  },
  cardIconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  cardKicker: {
    fontSize: fonts.label,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.goldDim,
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
  },
  cardBody: {
    fontSize: fonts.body,
    lineHeight: 22,
    color: colors.textMuted,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingBottom: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(201, 162, 39, 0.3)',
  },
});
