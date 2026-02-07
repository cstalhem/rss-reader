import { Box, Text } from "@chakra-ui/react";
import AppShell from "@/components/layout/AppShell";

export default function Home() {
  return (
    <AppShell>
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        minHeight="calc(100vh - 64px)"
        p={8}
      >
        <Text fontSize="lg" color="fg.muted">
          Articles will appear here
        </Text>
      </Box>
    </AppShell>
  );
}
