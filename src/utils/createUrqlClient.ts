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
    console.log("allFields: ", allFields);
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
    // Loop through fieldInfos and retrieve its data, pushing it to results array
    const results: string[] = [];
    fieldInfos.forEach((fi) => {
      // DEPRECIATED: const data = cache.resolveFieldByKey(entityKey, fi.fieldKey) as string[];
      // resolve retrieves value of the field on the provided entity
      const data = cache.resolve(entityKey, fi.fieldKey) as string[];
      results.push(...data);
    });
    // Return array of posts
    return results;
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
      resolvers: {
        Query: {
          posts: cursorPagination(),
        },
      },
      updates: {
        Mutation: {
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
