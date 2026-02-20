"use client";

import { Box, Flex, Skeleton, Stack } from "@chakra-ui/react";

function ParentGroupSkeleton({
  nameWidth,
  childWidths,
}: {
  nameWidth: string;
  childWidths: string[];
}) {
  return (
    <Box>
      {/* Parent row */}
      <Flex
        alignItems="center"
        gap={2}
        py={3}
        px={3}
        bg="bg.subtle"
        borderRadius="sm"
      >
        <Skeleton variant="shine" borderRadius="full" boxSize="14px" />
        <Skeleton variant="shine" borderRadius="full" boxSize="16px" />
        <Skeleton variant="shine" height="16px" width={nameWidth} />
        <Skeleton variant="shine" height="14px" width="24px" borderRadius="md" />
      </Flex>

      {/* Child rows */}
      <Box ml={6} pl={3}>
        <Stack gap={1}>
          {childWidths.map((width, idx) => (
            <Flex key={idx} alignItems="center" gap={2} py={2} px={3}>
              <Skeleton variant="shine" boxSize="16px" borderRadius="sm" />
              <Skeleton variant="shine" height="14px" width={width} />
            </Flex>
          ))}
        </Stack>
      </Box>
    </Box>
  );
}

export function CategoriesTreeSkeleton() {
  return (
    <Stack gap={1}>
        <ParentGroupSkeleton nameWidth="140px" childWidths={["120px", "90px"]} />
        <ParentGroupSkeleton nameWidth="170px" childWidths={["100px", "130px"]} />
        <ParentGroupSkeleton nameWidth="120px" childWidths={["140px", "80px"]} />

        {/* Ungrouped rows */}
        <Flex alignItems="center" gap={2} py={2} px={3}>
          <Skeleton variant="shine" boxSize="16px" borderRadius="sm" />
          <Skeleton variant="shine" height="14px" width="110px" />
        </Flex>
        <Flex alignItems="center" gap={2} py={2} px={3}>
          <Skeleton variant="shine" boxSize="16px" borderRadius="sm" />
          <Skeleton variant="shine" height="14px" width="95px" />
        </Flex>
    </Stack>
  );
}
