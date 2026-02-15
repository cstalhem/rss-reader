"use client";

import { useState } from "react";
import { Box, Container, Flex, Stack } from "@chakra-ui/react";
import { Header } from "@/components/layout/Header";
import { SettingsSidebar, SettingsSection } from "@/components/settings/SettingsSidebar";
import { InterestsSection } from "@/components/settings/InterestsSection";
import { FeedsSection } from "@/components/settings/FeedsSection";
import { OllamaSection } from "@/components/settings/OllamaSection";
import { FeedbackPlaceholder } from "@/components/settings/FeedbackPlaceholder";

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>("interests");

  return (
    <Box minHeight="100vh" bg="bg">
      <Header />
      <Container maxW="5xl" py={8} px={6} pt="88px">
        <Flex gap={8}>
          {/* Sidebar navigation - hidden on mobile */}
          <Box
            display={{ base: "none", md: "block" }}
            width="200px"
            flexShrink={0}
          >
            <SettingsSidebar
              activeSection={activeSection}
              onSectionChange={setActiveSection}
            />
          </Box>

          {/* Content area */}
          <Box flex={1} minW={0}>
            {/* Mobile: show all sections stacked */}
            <Box display={{ base: "block", md: "none" }}>
              <Stack gap={10}>
                <FeedsSection />
                <InterestsSection />
                <OllamaSection isVisible={true} />
                <FeedbackPlaceholder />
              </Stack>
            </Box>

            {/* Desktop: show active section only, keep all mounted to preserve state */}
            <Box display={{ base: "none", md: "block" }}>
              <Box display={activeSection === "feeds" ? "block" : "none"}>
                <FeedsSection />
              </Box>
              <Box display={activeSection === "interests" ? "block" : "none"}>
                <InterestsSection />
              </Box>
              <Box display={activeSection === "ollama" ? "block" : "none"}>
                <OllamaSection isVisible={activeSection === "ollama"} />
              </Box>
              <Box display={activeSection === "feedback" ? "block" : "none"}>
                <FeedbackPlaceholder />
              </Box>
            </Box>
          </Box>
        </Flex>
      </Container>
    </Box>
  );
}
