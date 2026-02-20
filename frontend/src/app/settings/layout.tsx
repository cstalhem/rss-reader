import { Box, Container, Flex } from "@chakra-ui/react";
import { Header } from "@/components/layout/Header";
import { SettingsSidebar } from "@/components/settings/SettingsSidebar";
import { SettingsMobileNav } from "@/components/settings/SettingsMobileNav";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Box minHeight="100vh" bg="bg">
      <Header />
      <Container maxW="5xl" py={8} px={6} pt="88px">
        <Flex gap={8}>
          {/* Desktop sidebar nav */}
          <Box
            as="nav"
            display={{ base: "none", md: "block" }}
            width="200px"
            flexShrink={0}
          >
            <SettingsSidebar />
          </Box>

          {/* Content area */}
          <Box
            flex={1}
            minW={0}
            overflowY="auto"
            maxH="calc(100vh - 88px - 64px)"
            css={{ scrollbarGutter: "stable" }}
          >
            {/* Mobile dropdown nav */}
            <Box display={{ base: "block", md: "none" }} mb={4}>
              <SettingsMobileNav />
            </Box>

            {children}
          </Box>
        </Flex>
      </Container>
    </Box>
  );
}
