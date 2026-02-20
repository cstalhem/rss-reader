"use client";

import { useDeferredValue, useState } from "react";
import { Box, Container, Flex, Stack } from "@chakra-ui/react";
import { Header } from "@/components/layout/Header";
import {
  SettingsSidebar,
  SettingsSection,
} from "@/components/settings/SettingsSidebar";
import { InterestsSection } from "@/components/settings/InterestsSection";
import { FeedsSection } from "@/components/settings/FeedsSection";
import { OllamaSection } from "@/components/settings/OllamaSection";
import { CategoriesSection } from "@/components/settings/CategoriesSection";
import { FeedbackPlaceholder } from "@/components/settings/FeedbackPlaceholder";
import { CategoriesTreeSkeleton } from "@/components/settings/CategoriesTreeSkeleton";

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>("feeds");
  const deferredSection = useDeferredValue(activeSection);
  const isPending = activeSection !== deferredSection;

  return (
    <Box minHeight='100vh' bg='bg'>
      <Header />
      <Container maxW='5xl' py={8} px={6} pt='88px'>
        <Flex gap={8}>
          {/* Sidebar navigation - hidden on mobile */}
          <Box
            display={{ base: "none", md: "block" }}
            width='200px'
            flexShrink={0}
          >
            <SettingsSidebar
              activeSection={activeSection}
              onSectionChange={setActiveSection}
            />
          </Box>

          {/* Content area */}
          <Box
            flex={1}
            minW={0}
            overflowY='auto'
            maxH='calc(100vh - 88px - 64px)'
            css={{ scrollbarGutter: "stable" }}
          >
            {/* Mobile: show all sections stacked */}
            <Box display={{ base: "block", md: "none" }}>
              <Stack gap={10}>
                <FeedsSection />
                <InterestsSection />
                <CategoriesSection />
                <OllamaSection isVisible={true} />
                <FeedbackPlaceholder />
              </Stack>
            </Box>

            {/* Desktop: mount only the active section (uses deferredSection so heavy renders don't block sidebar) */}
            <Box display={{ base: "none", md: "block" }}>
              {isPending && activeSection === "categories" ? (
                <CategoriesTreeSkeleton withShell />
              ) : (
                <>
                  {deferredSection === "feeds" && <FeedsSection />}
                  {deferredSection === "interests" && <InterestsSection />}
                  {deferredSection === "categories" && <CategoriesSection />}
                  {deferredSection === "ollama" && <OllamaSection isVisible={true} />}
                  {deferredSection === "feedback" && <FeedbackPlaceholder />}
                </>
              )}
            </Box>
          </Box>
        </Flex>
      </Container>
    </Box>
  );
}
