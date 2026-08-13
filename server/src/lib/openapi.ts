/**
 * Runtime-aligned OpenAPI 3.0 description for the Express API.
 *
 * The browser client sends the `session` cookie automatically after login.
 * Swagger UI users can authorize with that same cookie when testing protected
 * endpoints locally.
 */
export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Storefront Ratings API",
    version: "1.0.0",
    description:
      "Role-based store ratings API for the FullStack Intern Coding Challenge. Public registration uses a six-digit email OTP; protected endpoints use an HttpOnly session cookie.",
  },
  servers: [
    {
      url: "http://localhost:4000/api",
      description: "Local Express API",
    },
  ],
  tags: [
    { name: "Health" },
    { name: "Authentication" },
    { name: "Stores" },
    { name: "Administration" },
    { name: "Store Owner" },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Check API and database connectivity",
        responses: {
          "200": { $ref: "#/components/responses/Health" },
          "503": { $ref: "#/components/responses/DatabaseUnavailable" },
        },
      },
    },
    "/auth/register": {
      post: {
        tags: ["Authentication"],
        summary: "Start normal-user registration",
        description:
          "Creates or replaces a pending normal-user registration and sends a verification OTP. The plaintext OTP is never included in the response.",
        requestBody: { $ref: "#/components/requestBodies/Register" },
        responses: {
          "202": {
            description: "Verification email accepted for delivery",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RegistrationAcceptedResponse" },
              },
            },
          },
          "409": { $ref: "#/components/responses/EmailUnavailable" },
          "422": { $ref: "#/components/responses/ValidationError" },
          "429": { $ref: "#/components/responses/RateLimited" },
          "503": { $ref: "#/components/responses/ServiceUnavailable" },
        },
      },
    },
    "/auth/invitations/{token}": {
      get: {
        tags: ["Authentication"],
        summary: "Validate a confidential privileged-registration invitation",
        description:
          "Returns only the role, masked recipient email, and expiry for a live invitation. The bearer token is not returned or logged.",
        parameters: [{ $ref: "#/components/parameters/InvitationToken" }],
        responses: {
          "200": {
            description: "A live administrator or store-owner invitation",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/InvitationDetailsResponse" },
              },
            },
          },
          "404": { $ref: "#/components/responses/InvitationNotAvailable" },
          "410": { $ref: "#/components/responses/InvitationExpired" },
          "429": { $ref: "#/components/responses/RateLimited" },
        },
      },
    },
    "/auth/invitations/{token}/register": {
      post: {
        tags: ["Authentication"],
        summary: "Redeem a one-time privileged-registration invitation",
        description:
          "The role and recipient email are derived from the server-side invitation. A one-time first-administrator bootstrap additionally requires email when no administrator exists.",
        parameters: [{ $ref: "#/components/parameters/InvitationToken" }],
        requestBody: { $ref: "#/components/requestBodies/PrivilegedInvitationRegistration" },
        responses: {
          "201": {
            description: "Verified privileged account created; invite is consumed",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/UserResponse" } },
            },
          },
          "400": { $ref: "#/components/responses/InvitationCodeInvalid" },
          "404": { $ref: "#/components/responses/InvitationNotAvailable" },
          "409": { $ref: "#/components/responses/Conflict" },
          "410": { $ref: "#/components/responses/InvitationExpired" },
          "422": { $ref: "#/components/responses/ValidationError" },
          "429": { $ref: "#/components/responses/RateLimited" },
        },
      },
    },
    "/auth/verify-email": {
      post: {
        tags: ["Authentication"],
        summary: "Verify OTP and create the account",
        requestBody: { $ref: "#/components/requestBodies/VerifyEmail" },
        responses: {
          "201": {
            description: "Verified normal-user account created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UserResponse" },
              },
            },
          },
          "400": { $ref: "#/components/responses/OtpInvalid" },
          "409": { $ref: "#/components/responses/Conflict" },
          "422": { $ref: "#/components/responses/ValidationError" },
          "429": { $ref: "#/components/responses/RateLimited" },
        },
      },
    },
    "/auth/resend-verification": {
      post: {
        tags: ["Authentication"],
        summary: "Resend the current registration OTP",
        requestBody: { $ref: "#/components/requestBodies/Email" },
        responses: {
          "202": {
            description: "A response that does not disclose whether a registration exists",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ResendResponse" },
              },
            },
          },
          "422": { $ref: "#/components/responses/ValidationError" },
          "429": { $ref: "#/components/responses/RateLimited" },
          "503": { $ref: "#/components/responses/ServiceUnavailable" },
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Authentication"],
        summary: "Sign in and set the session cookie",
        requestBody: { $ref: "#/components/requestBodies/Login" },
        responses: {
          "200": {
            description: "Session started",
            headers: {
              "Set-Cookie": {
                schema: { type: "string" },
                description: "HttpOnly session cookie.",
              },
            },
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UserResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/InvalidCredentials" },
          "403": { $ref: "#/components/responses/EmailUnverified" },
          "422": { $ref: "#/components/responses/ValidationError" },
          "429": { $ref: "#/components/responses/RateLimited" },
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Authentication"],
        summary: "Clear the session cookie",
        description: "Safe to call without a current session.",
        responses: {
          "204": { description: "Session cookie cleared" },
        },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Authentication"],
        summary: "Get the authenticated user",
        security: [{ sessionCookie: [] }],
        responses: {
          "200": {
            description: "Current verified user",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UserResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthenticated" },
        },
      },
    },
    "/auth/password": {
      patch: {
        tags: ["Authentication"],
        summary: "Change the authenticated user's password",
        security: [{ sessionCookie: [] }],
        requestBody: { $ref: "#/components/requestBodies/ChangePassword" },
        responses: {
          "200": {
            description: "Password updated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MessageResponse" },
              },
            },
          },
          "400": { $ref: "#/components/responses/CurrentPasswordInvalid" },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "422": { $ref: "#/components/responses/ValidationError" },
          "429": { $ref: "#/components/responses/RateLimited" },
        },
      },
    },
    "/stores": {
      get: {
        tags: ["Stores"],
        summary: "List stores available to a normal user",
        description:
          "Returns every matching store, including aggregate and caller-specific rating data.",
        security: [{ sessionCookie: [] }],
        parameters: [
          { $ref: "#/components/parameters/Search" },
          { $ref: "#/components/parameters/StoreSortBy" },
          { $ref: "#/components/parameters/SortDirection" },
        ],
        responses: {
          "200": {
            description: "Store directory",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/StoreListResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "403": { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/stores/{storeId}/rating": {
      put: {
        tags: ["Stores"],
        summary: "Create or update the caller's rating",
        security: [{ sessionCookie: [] }],
        parameters: [{ $ref: "#/components/parameters/StoreId" }],
        requestBody: { $ref: "#/components/requestBodies/Rating" },
        responses: {
          "200": {
            description: "Rating upserted",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RatingUpsertResponse" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/StoreNotFound" },
          "422": { $ref: "#/components/responses/ValidationError" },
        },
      },
    },
    "/admin/dashboard": {
      get: {
        tags: ["Administration"],
        summary: "Get platform totals",
        security: [{ sessionCookie: [] }],
        responses: {
          "200": {
            description: "User, store, and rating totals",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AdminDashboardResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "403": { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/admin/invitations": {
      post: {
        tags: ["Administration"],
        summary: "Create a confidential privileged-registration invitation",
        description:
          "Creates a one-time, 72-hour invitation for an administrator or store owner. The raw link token and code are returned only in this initial administrator-only response and are never persisted.",
        security: [{ sessionCookie: [] }],
        requestBody: { $ref: "#/components/requestBodies/PrivilegedInvitation" },
        responses: {
          "201": {
            description: "Invitation created; copy the returned token and code immediately",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PrivilegedInvitationCreatedResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "409": { $ref: "#/components/responses/EmailUnavailable" },
          "422": { $ref: "#/components/responses/ValidationError" },
        },
      },
    },
    "/admin/users": {
      get: {
        tags: ["Administration"],
        summary: "List and filter managed users",
        security: [{ sessionCookie: [] }],
        parameters: [
          { $ref: "#/components/parameters/UserName" },
          { $ref: "#/components/parameters/UserEmail" },
          { $ref: "#/components/parameters/UserAddress" },
          { $ref: "#/components/parameters/Role" },
          { $ref: "#/components/parameters/UserSortBy" },
          { $ref: "#/components/parameters/SortDirection" },
        ],
        responses: {
          "200": {
            description: "Managed user list",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UserListResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "403": { $ref: "#/components/responses/Forbidden" },
        },
      },
      post: {
        tags: ["Administration"],
        summary: "Provision an administrator, normal user, or store owner",
        security: [{ sessionCookie: [] }],
        requestBody: { $ref: "#/components/requestBodies/AdminUser" },
        responses: {
          "201": {
            description: "Managed user created and marked verified",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UserResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "409": { $ref: "#/components/responses/Conflict" },
          "422": { $ref: "#/components/responses/ValidationError" },
        },
      },
    },
    "/admin/users/{userId}": {
      get: {
        tags: ["Administration"],
        summary: "Get a managed user and any owned-store summary",
        security: [{ sessionCookie: [] }],
        parameters: [{ $ref: "#/components/parameters/UserId" }],
        responses: {
          "200": {
            description: "Managed user detail",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UserDetailResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/UserNotFound" },
        },
      },
    },
    "/admin/stores": {
      get: {
        tags: ["Administration"],
        summary: "List and search stores",
        security: [{ sessionCookie: [] }],
        parameters: [
          { $ref: "#/components/parameters/Search" },
          { $ref: "#/components/parameters/StoreSortBy" },
          { $ref: "#/components/parameters/SortDirection" },
        ],
        responses: {
          "200": {
            description: "Managed store list",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AdminStoreListResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "403": { $ref: "#/components/responses/Forbidden" },
        },
      },
      post: {
        tags: ["Administration"],
        summary: "Create a store and optionally assign an eligible owner",
        security: [{ sessionCookie: [] }],
        requestBody: { $ref: "#/components/requestBodies/Store" },
        responses: {
          "201": {
            description: "Store created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AdminStoreResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "409": { $ref: "#/components/responses/Conflict" },
          "422": { $ref: "#/components/responses/ValidationError" },
        },
      },
    },
    "/owner/dashboard": {
      get: {
        tags: ["Store Owner"],
        summary: "Get the caller's store, average, and raters",
        security: [{ sessionCookie: [] }],
        parameters: [
          { $ref: "#/components/parameters/OwnerSortBy" },
          { $ref: "#/components/parameters/SortDirection" },
        ],
        responses: {
          "200": {
            description: "Scoped Store Owner dashboard",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OwnerDashboardResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthenticated" },
          "403": { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      sessionCookie: {
        type: "apiKey",
        in: "cookie",
        name: "session",
        description: "HttpOnly JWT session cookie set by POST /auth/login.",
      },
    },
    parameters: {
      StoreId: {
        name: "storeId",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
      },
      UserId: {
        name: "userId",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
      },
      InvitationToken: {
        name: "token",
        in: "path",
        required: true,
        schema: { type: "string", minLength: 32 },
        description: "Confidential opaque invitation bearer token.",
      },
      Search: {
        name: "search",
        in: "query",
        schema: { type: "string" },
      },
      SortDirection: {
        name: "sortDir",
        in: "query",
        schema: { type: "string", enum: ["asc", "desc"], default: "asc" },
      },
      StoreSortBy: {
        name: "sortBy",
        in: "query",
        schema: {
          type: "string",
          enum: ["name", "email", "address", "createdAt"],
          default: "name",
        },
      },
      UserSortBy: {
        name: "sortBy",
        in: "query",
        schema: {
          type: "string",
          enum: ["name", "email", "address", "role", "createdAt"],
          default: "name",
        },
      },
      OwnerSortBy: {
        name: "sortBy",
        in: "query",
        schema: { type: "string", enum: ["name", "email", "address", "rating"], default: "name" },
      },
      UserName: { name: "name", in: "query", schema: { type: "string" } },
      UserEmail: { name: "email", in: "query", schema: { type: "string", format: "email" } },
      UserAddress: { name: "address", in: "query", schema: { type: "string" } },
      Role: {
        name: "role",
        in: "query",
        schema: { $ref: "#/components/schemas/Role" },
      },
    },
    requestBodies: {
      Register: {
        required: true,
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/RegisterRequest" } },
        },
      },
      VerifyEmail: {
        required: true,
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/VerifyEmailRequest" } },
        },
      },
      Email: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/EmailRequest" } } },
      },
      Login: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } },
      },
      ChangePassword: {
        required: true,
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/ChangePasswordRequest" } },
        },
      },
      Rating: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/RatingRequest" } } },
      },
      AdminUser: {
        required: true,
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/AdminUserRequest" } },
        },
      },
      Store: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/StoreRequest" } } },
      },
      PrivilegedInvitation: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/PrivilegedInvitationRequest" },
          },
        },
      },
      PrivilegedInvitationRegistration: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/PrivilegedInvitationRegistrationRequest" },
          },
        },
      },
    },
    schemas: {
      Role: { type: "string", enum: ["ADMIN", "NORMAL_USER", "STORE_OWNER"] },
      PrivilegedInvitationRole: { type: "string", enum: ["ADMIN", "STORE_OWNER"] },
      User: {
        type: "object",
        required: ["id", "name", "email", "address", "role", "emailVerified", "createdAt"],
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string", minLength: 20, maxLength: 60 },
          email: { type: "string", format: "email" },
          address: { type: "string", maxLength: 400 },
          role: { $ref: "#/components/schemas/Role" },
          emailVerified: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Owner: {
        type: "object",
        required: ["id", "name", "email"],
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          email: { type: "string", format: "email" },
        },
      },
      StoreSummary: {
        type: "object",
        required: ["id", "name", "email", "address", "createdAt", "averageRating", "ratingCount"],
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string", minLength: 20, maxLength: 60 },
          email: { type: "string", format: "email" },
          address: { type: "string", maxLength: 400 },
          createdAt: { type: "string", format: "date-time" },
          averageRating: { type: "number", nullable: true, minimum: 1, maximum: 5 },
          ratingCount: { type: "integer", minimum: 0 },
        },
      },
      StoreForNormalUser: {
        allOf: [
          { $ref: "#/components/schemas/StoreSummary" },
          {
            type: "object",
            required: ["submittedRating"],
            properties: {
              submittedRating: { type: "integer", nullable: true, minimum: 1, maximum: 5 },
            },
          },
        ],
      },
      StoreForAdmin: {
        allOf: [
          { $ref: "#/components/schemas/StoreSummary" },
          {
            type: "object",
            required: ["owner"],
            properties: {
              owner: { allOf: [{ $ref: "#/components/schemas/Owner" }], nullable: true },
            },
          },
        ],
      },
      OwnerStore: {
        type: "object",
        required: ["id", "name", "email", "address", "averageRating", "ratingCount"],
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string", minLength: 20, maxLength: 60 },
          email: { type: "string", format: "email" },
          address: { type: "string", maxLength: 400 },
          averageRating: { type: "number", nullable: true, minimum: 1, maximum: 5 },
          ratingCount: { type: "integer", minimum: 0 },
        },
      },
      Rater: {
        type: "object",
        required: ["id", "value", "updatedAt", "user"],
        properties: {
          id: { type: "string", format: "uuid" },
          value: { type: "integer", minimum: 1, maximum: 5 },
          updatedAt: { type: "string", format: "date-time" },
          user: {
            type: "object",
            required: ["id", "name", "email", "address"],
            properties: {
              id: { type: "string", format: "uuid" },
              name: { type: "string" },
              email: { type: "string", format: "email" },
              address: { type: "string" },
            },
          },
        },
      },
      OwnedStore: {
        type: "object",
        required: ["id", "name", "averageRating", "ratingCount"],
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          averageRating: { type: "number", nullable: true, minimum: 1, maximum: 5 },
          ratingCount: { type: "integer", minimum: 0 },
        },
      },
      Rating: {
        type: "object",
        required: ["id", "value", "updatedAt"],
        properties: {
          id: { type: "string", format: "uuid" },
          value: { type: "integer", minimum: 1, maximum: 5 },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      RegisterRequest: {
        type: "object",
        required: ["name", "email", "address", "password"],
        properties: {
          name: { type: "string", minLength: 20, maxLength: 60 },
          email: { type: "string", format: "email" },
          address: { type: "string", minLength: 1, maxLength: 400 },
          password: {
            type: "string",
            minLength: 8,
            maxLength: 16,
            description: "Includes an uppercase letter and a non-whitespace special character.",
          },
        },
      },
      VerifyEmailRequest: {
        type: "object",
        required: ["email", "otp"],
        properties: {
          email: { type: "string", format: "email" },
          otp: { type: "string", pattern: "^[0-9]{6}$" },
        },
      },
      EmailRequest: {
        type: "object",
        required: ["email"],
        properties: { email: { type: "string", format: "email" } },
      },
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", minLength: 1 },
        },
      },
      ChangePasswordRequest: {
        type: "object",
        required: ["currentPassword", "newPassword"],
        properties: {
          currentPassword: { type: "string", minLength: 1 },
          newPassword: { type: "string", minLength: 8, maxLength: 16 },
        },
      },
      RatingRequest: {
        type: "object",
        required: ["value"],
        properties: { value: { type: "integer", minimum: 1, maximum: 5 } },
      },
      AdminUserRequest: {
        allOf: [
          { $ref: "#/components/schemas/RegisterRequest" },
          {
            type: "object",
            required: ["role"],
            properties: { role: { $ref: "#/components/schemas/Role" } },
          },
        ],
      },
      PrivilegedInvitationRequest: {
        type: "object",
        required: ["email", "role"],
        properties: {
          email: { type: "string", format: "email" },
          role: { $ref: "#/components/schemas/PrivilegedInvitationRole" },
        },
      },
      PrivilegedInvitationRegistrationRequest: {
        type: "object",
        required: ["code", "name", "address", "password"],
        properties: {
          code: {
            type: "string",
            pattern: "^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$",
          },
          name: { type: "string", minLength: 20, maxLength: 60 },
          address: { type: "string", minLength: 1, maxLength: 400 },
          password: { type: "string", minLength: 8, maxLength: 16 },
          email: {
            type: "string",
            format: "email",
            description:
              "Omit for a database invitation; required only by the one-time first-administrator bootstrap.",
          },
        },
      },
      StoreRequest: {
        type: "object",
        required: ["name", "email", "address"],
        properties: {
          name: { type: "string", minLength: 20, maxLength: 60 },
          email: { type: "string", format: "email" },
          address: { type: "string", minLength: 1, maxLength: 400 },
          ownerId: { type: "string", nullable: true, format: "uuid" },
        },
      },
      Error: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message"],
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              fields: { type: "object", additionalProperties: { type: "string" } },
            },
          },
        },
      },
      HealthResponse: {
        type: "object",
        properties: {
          data: {
            type: "object",
            required: ["status", "database"],
            properties: {
              status: { type: "string", example: "ok" },
              database: { type: "string", example: "connected" },
            },
          },
        },
      },
      RegistrationAcceptedResponse: {
        type: "object",
        properties: {
          data: {
            type: "object",
            required: ["email", "maskedEmail", "resendAvailableAt"],
            properties: {
              email: { type: "string", format: "email" },
              maskedEmail: { type: "string" },
              resendAvailableAt: { type: "string", format: "date-time" },
            },
          },
        },
      },
      InvitationDetailsResponse: {
        type: "object",
        required: ["data"],
        properties: {
          data: {
            type: "object",
            required: ["role", "expiresAt", "requiresEmail"],
            properties: {
              role: { $ref: "#/components/schemas/PrivilegedInvitationRole" },
              maskedEmail: { type: "string" },
              expiresAt: { type: "string", format: "date-time" },
              requiresEmail: { type: "boolean" },
            },
          },
        },
      },
      PrivilegedInvitationCreatedResponse: {
        type: "object",
        required: ["data"],
        properties: {
          data: {
            type: "object",
            required: ["email", "role", "expiresAt", "token", "code"],
            properties: {
              email: { type: "string", format: "email" },
              role: { $ref: "#/components/schemas/PrivilegedInvitationRole" },
              expiresAt: { type: "string", format: "date-time" },
              token: { type: "string", description: "Return-once confidential bearer token." },
              code: {
                type: "string",
                description: "Return-once confidential eight-character code.",
              },
            },
          },
        },
      },
      ResendResponse: {
        type: "object",
        properties: {
          data: {
            type: "object",
            properties: {
              message: { type: "string" },
              resendAvailableAt: { type: "string", format: "date-time" },
            },
          },
        },
      },
      MessageResponse: {
        type: "object",
        properties: { data: { type: "object", properties: { message: { type: "string" } } } },
      },
      UserResponse: {
        type: "object",
        required: ["data"],
        properties: {
          data: {
            type: "object",
            required: ["user"],
            properties: { user: { $ref: "#/components/schemas/User" } },
          },
        },
      },
      UserListResponse: {
        type: "object",
        properties: {
          data: {
            type: "object",
            properties: { users: { type: "array", items: { $ref: "#/components/schemas/User" } } },
          },
        },
      },
      UserDetailResponse: {
        type: "object",
        properties: {
          data: {
            type: "object",
            properties: {
              user: { $ref: "#/components/schemas/User" },
              ownedStores: { type: "array", items: { $ref: "#/components/schemas/OwnedStore" } },
            },
          },
        },
      },
      StoreListResponse: {
        type: "object",
        properties: {
          data: {
            type: "object",
            properties: {
              stores: { type: "array", items: { $ref: "#/components/schemas/StoreForNormalUser" } },
            },
          },
        },
      },
      AdminStoreListResponse: {
        type: "object",
        properties: {
          data: {
            type: "object",
            properties: {
              stores: { type: "array", items: { $ref: "#/components/schemas/StoreForAdmin" } },
            },
          },
        },
      },
      AdminStoreResponse: {
        type: "object",
        properties: {
          data: {
            type: "object",
            properties: { store: { $ref: "#/components/schemas/StoreForAdmin" } },
          },
        },
      },
      RatingUpsertResponse: {
        type: "object",
        properties: {
          data: {
            type: "object",
            properties: {
              rating: { $ref: "#/components/schemas/Rating" },
              averageRating: { type: "number", nullable: true, minimum: 1, maximum: 5 },
              ratingCount: { type: "integer", minimum: 0 },
            },
          },
        },
      },
      AdminDashboardResponse: {
        type: "object",
        properties: {
          data: {
            type: "object",
            required: ["userCount", "storeCount", "ratingCount"],
            properties: {
              userCount: { type: "integer", minimum: 0 },
              storeCount: { type: "integer", minimum: 0 },
              ratingCount: { type: "integer", minimum: 0 },
            },
          },
        },
      },
      OwnerDashboardResponse: {
        type: "object",
        properties: {
          data: {
            type: "object",
            required: ["store", "raters"],
            properties: {
              store: { allOf: [{ $ref: "#/components/schemas/OwnerStore" }], nullable: true },
              raters: { type: "array", items: { $ref: "#/components/schemas/Rater" } },
            },
          },
        },
      },
    },
    responses: {
      Health: {
        description: "API and PostgreSQL are connected",
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/HealthResponse" } },
        },
      },
      BadRequest: {
        description: "Malformed request",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      ValidationError: {
        description: "Request validation failed",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      Unauthenticated: {
        description: "A valid verified session is required",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      Forbidden: {
        description: "The current role cannot access this endpoint",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      Conflict: {
        description: "The requested state conflicts with an existing record",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      EmailUnavailable: {
        description: "An account already uses this email",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      InvalidCredentials: {
        description: "Email or password is incorrect",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      EmailUnverified: {
        description: "The account has not completed OTP verification",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      CurrentPasswordInvalid: {
        description: "The current password is incorrect",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      OtpInvalid: {
        description: "OTP is invalid, used, or expired",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      InvitationCodeInvalid: {
        description: "The invitation code is incorrect",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      InvitationNotAvailable: {
        description: "Invitation token is invalid, used, or unavailable",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      InvitationExpired: {
        description: "Invitation has expired",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      RateLimited: {
        description: "Too many requests or OTP attempts",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      StoreNotFound: {
        description: "Store does not exist",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      UserNotFound: {
        description: "User does not exist",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      DatabaseUnavailable: {
        description: "PostgreSQL cannot be reached",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      ServiceUnavailable: {
        description: "A dependency such as PostgreSQL or SMTP is unavailable",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
    },
  },
};
