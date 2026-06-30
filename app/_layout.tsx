import { Stack } from "expo-router";
import { AuthProvider } from "../contexts/AuthContext";
import { SponsorProvider } from "../contexts/SponsorContext";

export default function RootLayout() {
  return (
    <SponsorProvider>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" />
          <Stack.Screen name="admin" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </AuthProvider>
    </SponsorProvider>
  );
}