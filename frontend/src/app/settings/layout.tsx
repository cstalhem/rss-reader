"use client";

import { Box, Flex, Heading } from "@chakra-ui/react";
import Link from "next/link";
import { LuArrowLeft } from "react-icons/lu";
import { SettingsSidebar } from "@/components/settings/SettingsSidebar";
import { SettingsMobileNav } from "@/components/settings/SettingsMobileNav";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  SIDEBAR_WIDTH_COLLAPSED,
  SIDEBAR_WIDTH_EXPANDED,
} from "@/lib/constants";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useLocalStorage(
    "sidebar-collapsed",
    false
  );

  return (
    <Box minHeight="100vh" bg="bg">
      <SettingsSidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      <Box
        as="main"
        ml={{
          base: 0,
          md: isSidebarCollapsed
            ? SIDEBAR_WIDTH_COLLAPSED
            : SIDEBAR_WIDTH_EXPANDED,
        }}
        px={{ base: 4, md: 8 }}
        py={8}
        transition="margin-left 0.2s ease"
      >
        <Box maxW="4xl" mx="auto" w="full">
          {/* Mobile heading row */}
          <Flex
            display={{ base: "flex", md: "none" }}
            alignItems="center"
            gap={2}
            mb={2}
          >
            <Link href="/">
              <Flex
                as="span"
                alignItems="center"
                justifyContent="center"
                w={8}
                h={8}
                borderRadius="md"
                color="fg.muted"
                _hover={{ bg: "bg.muted" }}
              >
                <LuArrowLeft size={18} />
              </Flex>
            </Link>
            <Heading fontSize="2xl" fontWeight="bold">
              Settings
            </Heading>
          </Flex>

          {/* Mobile dropdown nav */}
          <Box display={{ base: "block", md: "none" }} mb={4}>
            <SettingsMobileNav />
          </Box>

          {children}
        </Box>
      </Box>
    </Box>
  );
}
