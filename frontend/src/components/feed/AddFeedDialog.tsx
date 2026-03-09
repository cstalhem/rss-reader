"use client";

import { useState } from "react";
import {
  Dialog,
  Input,
  Button,
  Text,
  Flex,
  Spinner,
  Field,
} from "@chakra-ui/react";
import { useAddFeed, useUpdateFeed } from "@/hooks/useFeedMutations";

interface AddFeedDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = "url" | "loading" | "success";

export function AddFeedDialog({ isOpen, onClose }: AddFeedDialogProps) {
  const [step, setStep] = useState<Step>("url");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [feedTitle, setFeedTitle] = useState("");
  const [editedTitle, setEditedTitle] = useState("");
  const [feedId, setFeedId] = useState<number | null>(null);
  const [articleCount, setArticleCount] = useState(0);
  const addFeed = useAddFeed();
  const updateFeed = useUpdateFeed();

  const handleClose = () => {
    setStep("url");
    setUrl("");
    setError("");
    setFeedTitle("");
    setEditedTitle("");
    setFeedId(null);
    setArticleCount(0);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!url.trim()) {
      setError("Please enter a URL");
      return;
    }

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      setError("URL must start with http:// or https://");
      return;
    }

    setStep("loading");

    try {
      const feed = await addFeed.mutateAsync(url);
      setFeedId(feed.id);
      setFeedTitle(feed.title);
      setEditedTitle(feed.title);
      setArticleCount(feed.unread_count);
      setStep("success");
    } catch (err) {
      setStep("url");
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("already exists")) {
        setError("This feed already exists");
      } else if (message.includes("not a valid RSS feed")) {
        setError("URL is not a valid RSS feed");
      } else if (message.includes("Failed to fetch")) {
        setError("Failed to fetch URL. Please check the URL and try again.");
      } else {
        setError("Failed to add feed. Please try again.");
      }
    }
  };

  const saveName = async () => {
    if (feedId && editedTitle !== feedTitle) {
      await updateFeed.mutateAsync({ id: feedId, data: { title: editedTitle } });
    }
  };

  const handleDone = async () => {
    await saveName();
    handleClose();
  };

  const handleAddAnother = async () => {
    await saveName();
    setStep("url");
    setUrl("");
    setError("");
    setFeedTitle("");
    setEditedTitle("");
    setFeedId(null);
    setArticleCount(0);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={({ open }) => !open && handleClose()} placement="center">
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content maxW="md">
          <Dialog.Header>
            <Dialog.Title>Add RSS Feed</Dialog.Title>
          </Dialog.Header>

          <Dialog.Body>
            {step === "url" && (
              <form onSubmit={handleSubmit}>
                <Field.Root invalid={!!error}>
                  <Field.Label>Feed URL</Field.Label>
                  <Input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/feed.xml"
                    autoFocus
                  />
                  {error && <Field.ErrorText>{error}</Field.ErrorText>}
                </Field.Root>

                <Flex justifyContent="flex-end" mt={4} gap={2}>
                  <Button variant="ghost" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button type="submit" colorPalette="accent">
                    Add
                  </Button>
                </Flex>
              </form>
            )}

            {step === "loading" && (
              <Flex direction="column" alignItems="center" py={6} gap={4}>
                <Spinner size="lg" colorPalette="accent" />
                <Text color="fg.muted">Fetching feed...</Text>
              </Flex>
            )}

            {step === "success" && (
              <form onSubmit={(e) => { e.preventDefault(); handleDone(); }}>
                <Flex direction="column" gap={4}>
                  <Text color="fg.muted">
                    Found {articleCount} article{articleCount !== 1 ? "s" : ""}
                  </Text>

                  <Field.Root>
                    <Field.Label>Feed Name</Field.Label>
                    <Input
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                    />
                  </Field.Root>

                  <Flex justifyContent="flex-end" gap={2} mt={2}>
                    <Button variant="ghost" onClick={handleAddAnother} type="button">
                      Add Another
                    </Button>
                    <Button colorPalette="accent" type="submit" disabled={updateFeed.isPending}>
                      Done
                    </Button>
                  </Flex>
                </Flex>
              </form>
            )}
          </Dialog.Body>

          <Dialog.CloseTrigger />
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
