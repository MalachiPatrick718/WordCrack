import React, { useMemo, useRef, useState } from "react";
import { FlatList, Image, Text, View, useWindowDimensions, Pressable, StyleSheet } from "react-native";
import { markOnboarded } from "../AppRoot";
import { colors, shadows, borderRadius } from "../theme/colors";

type Slide = { title: string; body: string; emoji: string };

export function OnboardingScreen({ onComplete }: { navigation: any; onComplete: () => void }) {
  const { width } = useWindowDimensions();
  const slides: Slide[] = useMemo(
    () => [
      {
        emoji: "🔓",
        title: "Welcome to WordCrack",
        body: "A daily 6-letter cipher puzzle. Same puzzle for everyone, every day. Race against the clock!"
      },
      {
        emoji: "🔤",
        title: "Cipher Word",
        body: "You'll see a scrambled cipher word. Your goal is to crack the code and find the hidden target word."
      },
      {
        emoji: "🎯",
        title: "6 Letter Columns",
        body: "Each column shows 4-5 possible letters. Use the arrows to cycle through and find the right one."
      },
      {
        emoji: "⏱️",
        title: "Time & Penalties",
        body: "Your score is based on speed. Hints are available but they add time penalties. Use them wisely!"
      },
      {
        emoji: "🏆",
        title: "Compete & Win",
        body: "Challenge friends, climb leaderboards, and prove you're the fastest code cracker!"
      },
    ],
    [],
  );

  const listRef = useRef<FlatList<Slide>>(null);
  const [idx, setIdx] = useState(0);

  const onDone = async () => {
    await markOnboarded();
    onComplete();
  };

  return (
    <View style={styles.container}>
      {/* Logo at top */}
      <Image
        source={require("../../assets/icon.png")}
        style={styles.logo}
        resizeMode="contain"
      />

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
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={[styles.emojiContainer, { backgroundColor: colors.tiles[slides.indexOf(item) % colors.tiles.length] }]}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary.darkBlue,
  },
  logo: {
    width: 140,
    height: 90,
    alignSelf: "center",
    marginTop: 60,
    marginBottom: 20,
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
