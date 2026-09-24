// Clerk's sign-in / sign-up box: cream box on the black Nearest page.
export const clerkLightAppearance = {
  variables: {
    colorBackground: "#F4EFE6",
    colorForeground: "#141414",
    colorPrimary: "#141414",
    colorPrimaryForeground: "#F4EFE6",
    colorInput: "#FFFFFF",
    colorInputForeground: "#141414",
    colorMuted: "#EFE8DC",
    colorMutedForeground: "#6B665E",
    colorBorder: "#E2DBCF",
    colorNeutral: "#141414",
    colorDanger: "#B3261E",
    colorSuccess: "#2E7D4F",
    borderRadius: "14px",
    fontFamily: "var(--font-body), system-ui, sans-serif",
  },
  elements: {
    rootBox: { width: "100%" },
    cardBox: { width: "100%", boxShadow: "none", border: "none", borderRadius: "22px" },
  },
};

// Admin sign-in: same cream box, but no "Sign up" link. Owner logins are created in the Clerk dashboard.
export const clerkNoSignUpAppearance = {
  ...clerkLightAppearance,
  elements: { ...clerkLightAppearance.elements, footerAction: { display: "none" } },
};
