import { cacheExchange, Resolver } from "@urql/exchange-graphcache";
import Router from "next/router";
import {
  dedupExchange,
  Exchange,
  fetchExchange,
  stringifyVariables,
} from "urql";
import { pipe, tap } from "wonka";
import {
  LoginMutation,
  LogoutMutation,
  MeDocument,
  MeQuery,
  RegisterMutation,
} from "../generated/graphql";
import { betterUpdateQuery } from "./betterUpdateQuery";

// global errorExchange
// Captures errors in the urql client
// If it is an auth error, route the user to /login
export const errorExchange: Exchange =
  ({ forward }) =>
  (ops$) => {
    return pipe(
      forward(ops$),
      tap(({ error }) => {
        if (error?.message.includes("not authenticated")) {
          Router.replace("/login");
        }
      })
    );
  };

// cursorPagination
// Hooks into cache resolver
//
const cursorPagination = (): Resolver => {
  return (_parent, fieldArgs, cache, info) => {
    // entityKey - Query
    // fieldName - posts
    const { parentKey: entityKey, fieldName } = info;
    // inspectFields retrives *all known fields* for the given entityKey (Query) in the cache
    const allFields = cache.inspectFields(entityKey);
    // there may be fields on the entityKey we don't want so we filter that off
    const fieldInfos = allFields.filter((info) => info.fieldName === fieldName);

    // If there is no data (length of filtered fieldInfos array is 0) return undefined - cache miss ?
    const size = fieldInfos.length;
    if (size === 0) {
      return undefined;
    }

    // Generate fieldKey by combining fieldName + fieldArgs, e.g. `posts({"limit":10})`
    const fieldKey = `${fieldName}(${stringifyVariables(fieldArgs)})`;
    // Attempt to retrieve our data. If it is not in the cache, then we know there is a partial return.
    const isItInTheCache = cache.resolve(entityKey, fieldKey);
    // If info.partial is true (isItInTheCache is not null) then we are indicating data is uncached and missing
    info.partial = !isItInTheCache;
    // Default hasMore to true (we expect that there will be more posts to retrieve)
    let hasMore = true;
    // Loop through fieldInfos and retrieve its data
    const results: string[] = [];
    fieldInfos.forEach((fi) => {
      // DEPRECIATED: const data = cache.resolveFieldByKey(entityKey, fi.fieldKey) as string[];
      // resolve retrieves value of the field on the provided entity
      const key = cache.resolve(entityKey, fi.fieldKey) as string;
      const data = cache.resolve(key, "posts") as string[];
      // Check if the query has returned hasMore as true
      const _hasMore = cache.resolve(key, "hasMore");
      if (!_hasMore) {
        hasMore = _hasMore as boolean;
      }
      // Push the returning data into our results array
      results.push(...data);
    });
    // Return object of posts
    return {
      __typename: "PaginatedPosts",
      hasMore,
      posts: results,
    };
  };
};

// createUrqlClient
//
//
export const createUrqlClient = (ssrExchange: any) => ({
  url: "http://localhost:4000/graphql",
  fetchOptions: {
    credentials: "include" as const,
  },
  exchanges: [
    dedupExchange,
    cacheExchange({
      keys: {
        PaginatedPosts: () => null,
      },
      resolvers: {
        Query: {
          posts: cursorPagination(),
        },
      },
      updates: {
        Mutation: {
          // createPost cache updater
          // When createPost runs this will invalidate the cache of the post query,
          // forcing a fresh query when the home page loads to show the new post
          createPost: (_result, args, cache, info) => {
            const allFields = cache.inspectFields("Query");
            const fieldInfos = allFields.filter(
              (info) => info.fieldName === "posts"
            );
            fieldInfos.forEach((fi) => {
              cache.invalidate("Query", "posts", fi.arguments || {});
            });
          },
          // logout cache updater
          // Every time logout mutation runs this will update
          // the cache of the MeQuery with null user data.
          logout: (_result, args, cache, info) => {
            betterUpdateQuery<LogoutMutation, MeQuery>(
              cache,
              { query: MeDocument },
              _result,
              () => ({ me: null })
            );
          },
          // login cache updater
          // Every time login mutation runs this will update
          // the cache of the MeQuery with new user data.
          login: (_result, args, cache, info) => {
            betterUpdateQuery<LoginMutation, MeQuery>(
              cache,
              { query: MeDocument },
              _result,
              (result, query) => {
                // if login mutation returns error, return the existing MeQuery
                // else update `me` to the returned user data.
                if (result.login.errors) {
                  return query;
                } else {
                  return {
                    me: result.login.user,
                  };
                }
              }
            );
          },
          // register cache updater
          // Every time register mutation runs this will update
          // the cache of the MeQuery with new user data.
          register: (_result, args, cache, info) => {
            betterUpdateQuery<RegisterMutation, MeQuery>(
              cache,
              { query: MeDocument },
              _result,
              (result, query) => {
                // if register mutation returns error, return the existing MeQuery
                // else update `me` to the returned user data.
                if (result.register.errors) {
                  return query;
                } else {
                  return {
                    me: result.register.user,
                  };
                }
              }
            );
          },
        },
      },
    }),
    errorExchange,
    ssrExchange,
    fetchExchange,
  ],
});
