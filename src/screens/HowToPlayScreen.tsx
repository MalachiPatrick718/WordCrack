import React, { useMemo, useRef, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../AppRoot";
import { HOW_TO_PLAY_SLIDES, type HowToPlaySlide } from "../content/howToPlay";
import { useTheme } from "../theme/theme";

type Props = NativeStackScreenProps<RootStackParamList, "HowToPlay">;

export function HowToPlayScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<HowToPlaySlide>>(null);
  const [idx, setIdx] = useState(0);
  const { colors, shadows, borderRadius } = useTheme();
  const styles = useMemo(() => makeStyles(colors, shadows, borderRadius), [colors, shadows, borderRadius]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={styles.close}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
        <Text style={styles.headerTitle}>How to Play</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.logoCard}>
        <Image source={require("../../assets/icon.png")} style={styles.logo} resizeMode="contain" />
      </View>

      <FlatList
        ref={listRef}
        data={HOW_TO_PLAY_SLIDES}
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
        <View style={styles.indicators}>
          {HOW_TO_PLAY_SLIDES.map((_, i) => (
            <View key={i} style={[styles.indicator, i === idx ? styles.indicatorActive : styles.indicatorInactive]} />
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (idx < HOW_TO_PLAY_SLIDES.length - 1) listRef.current?.scrollToIndex({ index: idx + 1, animated: true });
            else navigation.goBack();
          }}
          style={({ pressed }) => [styles.nextButton, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.nextButtonText}>{idx < HOW_TO_PLAY_SLIDES.length - 1 ? "Next" : "Done"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (colors: any, shadows: any, borderRadius: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary.darkBlue,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 14,
    paddingHorizontal: 16,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: colors.text.light,
    fontWeight: "900",
    fontSize: 16,
  },
  close: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  closeText: {
    color: colors.text.light,
    fontWeight: "900",
    fontSize: 18,
  },
  logo: {
    width: 140,
    height: 90,
    alignSelf: "center",
    marginTop: 14,
  },
  logoCard: {
    alignSelf: "center",
    backgroundColor: "transparent",
    borderRadius: 0,
    padding: 0,
    marginTop: 14,
    marginBottom: 10,
  },
  slide: {
    paddingHorizontal: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  emojiContainer: {
    width: 94,
    height: 94,
    borderRadius: 47,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
    ...shadows.medium,
  },
  emoji: { fontSize: 44 },
  slideTitle: {
    color: colors.text.light,
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 14,
  },
  slideBody: {
    color: colors.primary.lightBlue,
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
  },
  footer: {
    padding: 20,
    paddingBottom: 34,
    gap: 14,
  },
  indicators: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  indicator: { width: 10, height: 10, borderRadius: 5 },
  indicatorActive: { backgroundColor: colors.primary.yellow, width: 24 },
  indicatorInactive: { backgroundColor: "rgba(255,255,255,0.3)" },
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
    fontWeight: "800",
  },
});

