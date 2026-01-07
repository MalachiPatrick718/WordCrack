import React, { useMemo, useRef, useState } from "react";
import { FlatList, Text, View, useWindowDimensions, Pressable } from "react-native";
import { markOnboarded } from "../AppRoot";

type Slide = { title: string; body: string };

export function OnboardingScreen({ navigation }: any) {
  const { width } = useWindowDimensions();
  const slides: Slide[] = useMemo(
    () => [
      { title: "Welcome to WordCrack", body: "A daily 6-letter cipher puzzle. Same puzzle for everyone, every day." },
      { title: "Cipher Word", body: "You’ll see: Word: CIPHER. You never see the target word." },
      { title: "6 Letter Columns", body: "Each column cycles through 4–5 letters. Use ▲/▼ (and swipe) to choose." },
      { title: "Time & Penalties", body: "Your score is time-based. Hints cost time immediately." },
      { title: "Leaderboards", body: "Compete globally and with friends. Lowest final time wins." },
    ],
    [],
  );

  const listRef = useRef<FlatList<Slide>>(null);
  const [idx, setIdx] = useState(0);

  const onDone = async () => {
    await markOnboarded();
    navigation.replace("Auth");
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#0B1020", paddingTop: 64 }}>
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
          <View style={{ width, paddingHorizontal: 24, justifyContent: "center" }}>
            <Text style={{ color: "white", fontSize: 28, fontWeight: "700", marginBottom: 12 }}>{item.title}</Text>
            <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 16, lineHeight: 22 }}>{item.body}</Text>
          </View>
        )}
      />

      <View style={{ padding: 24, gap: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 8 }}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: 8,
                backgroundColor: i === idx ? "white" : "rgba(255,255,255,0.25)",
              }}
            />
          ))}
        </View>

        {idx < slides.length - 1 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => listRef.current?.scrollToIndex({ index: idx + 1, animated: true })}
            style={{
              backgroundColor: "#6C5CE7",
              paddingVertical: 14,
              borderRadius: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "white", fontWeight: "700" }}>Next</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={onDone}
            style={{
              backgroundColor: "#2ECC71",
              paddingVertical: 14,
              borderRadius: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "white", fontWeight: "700" }}>Get Started</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}


