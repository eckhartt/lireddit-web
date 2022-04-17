import { ChevronUpIcon, ChevronDownIcon } from "@chakra-ui/icons";
import { Flex, IconButton } from "@chakra-ui/react";
import React, { useState } from "react";
import { PostSnippetFragment, useVoteMutation } from "../generated/graphql";

interface UpdootSectionProps {
  //   post: PostsQuery["posts"]["posts"][0]; // This is the notation for accessing the __type we want
  post: PostSnippetFragment;
}

// This section includes the UI elements used for voting
// Updoot, downdoot, and a display of current points
export const UpdootSection: React.FC<UpdootSectionProps> = ({ post }) => {
  const [, vote] = useVoteMutation();
  // Setting up state to track whether button is loading or has finished
  const [loadingState, setLoadingState] = useState<
    "updoot-loading" | "downdoot-loading" | "not-loading"
  >("not-loading");
  return (
    <Flex direction="column" justifyContent="center" alignItems="center" mr={4}>
      <IconButton
        aria-label="Increase Updoots"
        icon={<ChevronUpIcon />}
        colorScheme={post.voteStatus === 1 ? "green" : undefined}
        isLoading={loadingState === "updoot-loading"}
        onClick={async () => {
          console.log(`post.voteStatus: `, post.voteStatus);
          setLoadingState("updoot-loading");
          await vote({ postId: post.id, value: 1 });
          setLoadingState("not-loading");
        }}
      />
      {post.points}
      <IconButton
        aria-label="Decrease Updoots"
        icon={<ChevronDownIcon />}
        colorScheme={post.voteStatus === -1 ? "red" : undefined}
        isLoading={loadingState === "downdoot-loading"}
        onClick={async () => {
          console.log(`post.voteStatus: `, post.voteStatus);
          if (post.voteStatus === -1) {
            return;
          }
          setLoadingState("downdoot-loading");
          await vote({ postId: post.id, value: -1 });
          setLoadingState("not-loading");
        }}
      />
    </Flex>
  );
};
