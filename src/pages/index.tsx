import {
  ChevronDownIcon,
  ChevronUpIcon,
  DeleteIcon,
  EditIcon,
} from "@chakra-ui/icons";
import {
  Box,
  Button,
  Flex,
  Heading,
  IconButton,
  Link,
  Stack,
  Text,
} from "@chakra-ui/react";
import { withUrqlClient } from "next-urql";
import NextLink from "next/link";
import { useState } from "react";
import { Layout } from "../components/Layout";
import { UpdootSection } from "../components/UpdootSection";
import {
  useDeletePostMutation,
  useMeQuery,
  usePostsQuery,
} from "../generated/graphql";
import { createUrqlClient } from "../utils/createUrqlClient";

const Index = () => {
  // Setting up state for pagination variables
  const [variables, setVariables] = useState({
    limit: 15,
    cursor: null as null | string,
  });

  // useMeQuery
  const [{ data: meData }] = useMeQuery();

  // usePostsQuery
  const [{ data, fetching }] = usePostsQuery({
    variables,
  });

  // deletePost
  const [, deletePost] = useDeletePostMutation();

  // Query has finished and data was not obtained
  if (!fetching && !data) {
    return <div>query failed</div>;
  }
  // Query has finished and data was obtained
  return (
    <Layout>
      <br />
      {!data && fetching ? (
        <div>loading...</div>
      ) : (
        <Stack spacing={8}>
          {data!.posts.posts.map((p) =>
            // Check if post is null (because it was deleted). otherwise, return map section
            !p ? null : (
              <Flex key={p.id} p={5} shadow="md" borderWidth="1px">
                <UpdootSection post={p} />
                <Box flex={1}>
                  <NextLink href="/post/[id]" as={`/post/${p.id}`}>
                    <Link>
                      <Heading fontSize="xl">{p.title}</Heading>
                    </Link>
                  </NextLink>
                  <Text>Posted by {p.creator.username}</Text>
                  <Flex align="center">
                    <Text mt={4}>{p.textSnippet + "..."}</Text>
                    {meData?.me?.id !== p.creator.id ? null : (
                      <Box ml="auto">
                        <NextLink
                          href="/post/edit/[id]"
                          as={`/post/edit/${p.id}`}
                        >
                          <IconButton
                            as={Link}
                            mr={4}
                            icon={<EditIcon />}
                            aria-label="Edit Post"
                            onClick={() => {}}
                          />
                        </NextLink>
                        <IconButton
                          icon={<DeleteIcon />}
                          aria-label="Delete Post"
                          onClick={() => {
                            deletePost({ id: p.id });
                          }}
                        />
                      </Box>
                    )}
                  </Flex>
                </Box>
              </Flex>
            )
          )}
        </Stack>
      )}
      {data && data.posts.hasMore ? (
        <Flex>
          <Button
            onClick={() => {
              setVariables({
                limit: variables.limit,
                cursor: data.posts.posts[data.posts.posts.length - 1].createdAt,
              });
            }}
            isLoading={fetching}
            m="auto"
            my={8}
          >
            load more
          </Button>
        </Flex>
      ) : null}
    </Layout>
  );
};

export default withUrqlClient(createUrqlClient, { ssr: true })(Index);
