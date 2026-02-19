"use client";

import { useState, useEffect } from "react";
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
  const [titleSaved, setTitleSaved] = useState(false);

  const addFeed = useAddFeed();
  const updateFeed = useUpdateFeed();

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setStep("url");
      setUrl("");
      setError("");
      setFeedTitle("");
      setEditedTitle("");
      setFeedId(null);
      setArticleCount(0);
      setTitleSaved(false);
    }
  }, [isOpen]);

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
    } catch (err: any) {
      setStep("url");
      if (err.message.includes("already exists")) {
        setError("This feed already exists");
      } else if (err.message.includes("not a valid RSS feed")) {
        setError("URL is not a valid RSS feed");
      } else if (err.message.includes("Failed to fetch")) {
        setError("Failed to fetch URL. Please check the URL and try again.");
      } else {
        setError("Failed to add feed. Please try again.");
      }
    }
  };

  const handleSaveName = async () => {
    if (feedId && editedTitle !== feedTitle) {
      try {
        await updateFeed.mutateAsync({ id: feedId, data: { title: editedTitle } });
        setFeedTitle(editedTitle);
        setTitleSaved(true);
        setTimeout(() => setTitleSaved(false), 2000);
      } catch (err) {
        setError("Failed to update feed name");
      }
    }
  };

  const handleAddAnother = () => {
    setStep("url");
    setUrl("");
    setError("");
    setFeedTitle("");
    setEditedTitle("");
    setFeedId(null);
    setArticleCount(0);
    setTitleSaved(false);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={({ open }) => !open && onClose()} placement="center">
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
                  <Button variant="ghost" onClick={onClose}>
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

                {editedTitle !== feedTitle && (
                  <Button
                    size="sm"
                    colorPalette="accent"
                    onClick={handleSaveName}
                    disabled={updateFeed.isPending}
                  >
                    {updateFeed.isPending ? "Saving..." : "Save Name"}
                  </Button>
                )}

                {titleSaved && (
                  <Text fontSize="sm" color="fg.success">
                    Name saved!
                  </Text>
                )}

                <Flex justifyContent="flex-end" gap={2} mt={2}>
                  <Button variant="ghost" onClick={handleAddAnother}>
                    Add Another
                  </Button>
                  <Button colorPalette="accent" onClick={onClose}>
                    Done
                  </Button>
                </Flex>
              </Flex>
            )}
          </Dialog.Body>

          <Dialog.CloseTrigger />
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
