import React, { useMemo, useRef, useState } from "react";
import { FlatList, Image, Text, View, useWindowDimensions, Pressable, StyleSheet } from "react-native";
import { markOnboarded } from "../AppRoot";
import { useTheme } from "../theme/theme";
import { HOW_TO_PLAY_SLIDES, type HowToPlaySlide } from "../content/howToPlay";

export function OnboardingScreen({ onComplete }: { navigation: any; onComplete: () => void }) {
  const { width } = useWindowDimensions();
  const { colors, shadows, borderRadius } = useTheme();
  const styles = useMemo(() => makeStyles(colors, shadows, borderRadius), [colors, shadows, borderRadius]);
  // Reuse the same content as the in-app "How to Play" modal.
  const slides: HowToPlaySlide[] = useMemo(() => HOW_TO_PLAY_SLIDES, []);

  const listRef = useRef<FlatList<HowToPlaySlide>>(null);
  const [idx, setIdx] = useState(0);

  const onDone = async () => {
    await markOnboarded();
    onComplete();
  };

  return (
    <View style={styles.container}>
      {/* Logo at top */}
      <View style={styles.logoCard}>
        <Image
          source={require("../../assets/icon.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const next = Math.round(e.nativeEvent.contentOffset.x / width);
          setIdx(next);
        }}
        renderItem={({ item, index }) => (
          <View style={[styles.slide, { width }]}>
            <View style={[styles.emojiContainer, { backgroundColor: colors.tiles[index % colors.tiles.length] }]}>
              <Text style={styles.emoji}>{item.emoji}</Text>
            </View>
            <Text style={styles.slideTitle}>{item.title}</Text>
            <Text style={styles.slideBody}>{item.body}</Text>
          </View>
        )}
      />

      <View style={styles.footer}>
        {/* Page Indicators */}
        <View style={styles.indicators}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[
                styles.indicator,
                i === idx ? styles.indicatorActive : styles.indicatorInactive,
              ]}
            />
          ))}
        </View>

        {/* Navigation Button */}
        {idx < slides.length - 1 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => listRef.current?.scrollToIndex({ index: idx + 1, animated: true })}
            style={({ pressed }) => [
              styles.nextButton,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={styles.nextButtonText}>Next</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={onDone}
            style={({ pressed }) => [
              styles.startButton,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={styles.startButtonText}>Get Started</Text>
          </Pressable>
        )}

        {/* Skip link */}
        {idx < slides.length - 1 && (
          <Pressable
            accessibilityRole="button"
            onPress={onDone}
            style={styles.skipButton}
          >
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const makeStyles = (colors: any, shadows: any, borderRadius: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary.darkBlue,
  },
  logo: {
    width: 140,
    height: 90,
    alignSelf: "center",
    marginTop: 60,
  },
  logoCard: {
    alignSelf: "center",
    backgroundColor: "transparent",
    borderRadius: 0,
    padding: 0,
    marginBottom: 18,
  },
  slide: {
    paddingHorizontal: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  emojiContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    ...shadows.medium,
  },
  emoji: {
    fontSize: 48,
  },
  slideTitle: {
    color: colors.text.light,
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 16,
  },
  slideBody: {
    color: colors.primary.lightBlue,
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
  },
  footer: {
    padding: 24,
    paddingBottom: 48,
    gap: 16,
  },
  indicators: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  indicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  indicatorActive: {
    backgroundColor: colors.primary.yellow,
    width: 24,
  },
  indicatorInactive: {
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  nextButton: {
    backgroundColor: colors.primary.blue,
    paddingVertical: 16,
    borderRadius: borderRadius.large,
    alignItems: "center",
    ...shadows.small,
  },
  nextButtonText: {
    color: colors.text.light,
    fontSize: 18,
    fontWeight: "700",
  },
  startButton: {
    backgroundColor: colors.button.submit,
    paddingVertical: 16,
    borderRadius: borderRadius.large,
    alignItems: "center",
    ...shadows.small,
  },
  startButtonText: {
    color: colors.text.light,
    fontSize: 18,
    fontWeight: "800",
  },
  skipButton: {
    alignItems: "center",
    padding: 8,
  },
  skipText: {
    color: colors.primary.lightBlue,
    fontSize: 14,
    fontWeight: "600",
  },
});
