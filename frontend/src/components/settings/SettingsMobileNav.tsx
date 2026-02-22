"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createListCollection,
  Flex,
  Portal,
  Select,
  Text,
  useSelectContext,
} from "@chakra-ui/react";
import { SETTINGS_SECTIONS } from "@/lib/constants";
import type { SettingsSectionItem } from "@/lib/constants";

const sectionsCollection = createListCollection({
  items: SETTINGS_SECTIONS,
  itemToString: (item) => item.label,
  itemToValue: (item) => item.id,
});

function SectionValueText() {
  const select = useSelectContext();
  const items = select.selectedItems as SettingsSectionItem[];
  if (items.length === 0) return null;
  const item = items[0];
  const Icon = item.icon;
  return (
    <Select.ValueText>
      <Flex alignItems="center" gap={2}>
        <Icon size={16} />
        <Text>{item.label}</Text>
      </Flex>
    </Select.ValueText>
  );
}

export function SettingsMobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const activeSection = pathname.split("/").pop() ?? "general";

  return (
    <Select.Root
      collection={sectionsCollection}
      size="sm"
      value={[activeSection]}
      onValueChange={(details) => {
        const section = SETTINGS_SECTIONS.find((s) => s.id === details.value[0]);
        if (section) router.push(section.href);
      }}
      positioning={{ sameWidth: true }}
    >
      <Select.HiddenSelect />
      <Select.Control>
        <Select.Trigger>
          <SectionValueText />
        </Select.Trigger>
        <Select.IndicatorGroup>
          <Select.Indicator />
        </Select.IndicatorGroup>
      </Select.Control>
      <Portal>
        <Select.Positioner>
          <Select.Content>
            {SETTINGS_SECTIONS.map((section) => {
              const Icon = section.icon;
              return (
                <Select.Item key={section.id} item={section}>
                  <Flex alignItems="center" gap={2}>
                    <Icon size={16} />
                    <Text>{section.label}</Text>
                  </Flex>
                  <Select.ItemIndicator />
                </Select.Item>
              );
            })}
          </Select.Content>
        </Select.Positioner>
      </Portal>
    </Select.Root>
  );
}
