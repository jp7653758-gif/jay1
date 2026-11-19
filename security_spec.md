# Security Specification (`firestore.rules`)

## 1. Data Invariants
1. A `UserProfile` document at `/users/{userId}` can only be read, created, or updated by the verified Google-authenticated user whose `request.auth.uid == userId`.
2. Every `TransferHistoryRecord` at `/users/{userId}/transfers/{transferCode}` must belong to an existing parent `/users/{userId}` document whose `uid == request.auth.uid`, and `ownerUid` + `code` are immutable after creation.
3. No unauthenticated or unverified (`email_verified == false`) user can read, list, create, update, or delete any document.
4. Deleted transfers (`status == 'deleted'`) are terminal and cannot be modified afterward.
5. All string fields enforce explicit `.size()` bounds, IDs enforce `^[a-zA-Z0-9_\\-]+$`, numeric sizes/costs enforce bounds, and timestamps enforce `request.time`.

## 2. Adversarial "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated read of `/users/u1/transfers/abc12345` (`request.auth == null`).
2. Authenticated user `u2` reading `/users/u1/transfers/abc12345` (cross-tenant read).
3. Unverified email token (`email_verified: false`) writing `/users/u1`.
4. Shadow/ghost field injection (`isAdmin: true`) in `/users/u1` create payload (`hasOnly` rejects).
5. Shadow/ghost field injection (`discountBypass: true`) in `/users/u1/transfers/abc12345` create payload.
6. Identity spoofing (`ownerUid: "victimUid"`) in `/users/u1/transfers/abc12345` by attacker `u1`.
7. Resource poisoning with >180-char `destination` string or >128-char document ID (`isValidId` rejects).
8. Negative `totalBytes: -5` or `priceAmount: -1` in transfer record.
9. Client-forged `createdAt` timestamp not equal to `request.time`.
10. Modifying immutable fields (`ownerUid`, `code`, or `createdAt`) on update.
11. Modifying a transfer whose existing `status == 'deleted'` (terminal state lock bypass).
12. Enum poisoning on `paymentGateway: "free_bypass"` or `currency: "EUR"`.
