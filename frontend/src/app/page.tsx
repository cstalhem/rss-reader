import { Box, Heading, Text } from "@chakra-ui/react";

export default function Home() {
  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      bg="bg"
      color="fg"
    >
      <Box textAlign="center">
        <Heading size="2xl" mb={4}>
          RSS Reader
        </Heading>
        <Text color="fg.muted">
          Theme system initialized. Ready for content.
        </Text>
      </Box>
    </Box>
  );
}
