# Administrator access repair — 2026-10-10

- Project: `veltshop-website` (`prj_A9EGwzeF0tWSnfCvkpktXEfm1ix8`).
- Production: https://veltshop-website.vercel.app/admin
- Production deployment: `dpl_F5NRCCnju9npTQ4P2CQ2Wkmjw3Da`, READY, no alias error.
- Deployed source: `a14ad56b33825776536f07f13175a5d9613dab88`.
- Prior staging deployment reached READY before the explicit production deployment.
- TanStack Start patched to 1.168.60 and start-server-core 1.169.39; typecheck, build and full tests pass.
- Neon project `noisy-paper-66682518`, database `neondb`: applied migrations 0001–0011 confirmed after production build.
- The owner-requested existing account was granted `super_admin` transactionally. All 19 role permissions and an append-only audit event are present. The account is not disabled and has roles.manage/system.manage.
- The owner's password was not changed, read or requested. Administrator status is verified from production database permissions; an interactive login using the owner's password remains for the owner to verify.

Log out, sign in with the existing account, then open `/admin`. Invalid email/password is a separate password-authentication issue; the admin role does not reset a password. Missing payment/encryption/provider configuration and real-provider staging checks remain as described in the release runbook. This repair does not attest to readiness to accept money.

## Subsequent system release 0.4.0

Production 700704a0a3c224765923577ba49cc60a4448af6c (deployment dpl_5QJDXosgpYgq6r3BPYvsfXMUQUJB) is READY on the main domain; migration 0012 applied. The owner subsequently confirmed login/admin access after the authorized password reset. This release preserves the enabled super_admin role and all 19 permissions.
