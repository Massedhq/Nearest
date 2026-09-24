// Matches the Nearest mockups: black ground, pearl text and buttons.
export const clerkAppearance = {
  variables: {
    colorBackground: "#111113",
    colorForeground: "#ECE8E1",
    colorPrimary: "#ECE8E1",
    colorPrimaryForeground: "#0A0A0A",
    colorInput: "#0E0E10",
    colorInputForeground: "#ECE8E1",
    colorMuted: "#161618",
    colorMutedForeground: "#A8A399",
    colorBorder: "#2A2A2D",
    colorNeutral: "#ECE8E1",
    colorDanger: "#F2A38F",
    colorSuccess: "#9FD8B8",
    borderRadius: "14px",
    fontFamily: "var(--font-body), system-ui, sans-serif",
  },
  elements: {
    rootBox: { width: "100%" },
    cardBox: { width: "100%", boxShadow: "none", border: "1px solid #242427" },
  },
};

// Cream + black, for the student sign-up flow.
export const clerkLightAppearance = {
  variables: {
    colorBackground: "#FFFFFF",
    colorForeground: "#141414",
    colorPrimary: "#141414",
    colorPrimaryForeground: "#F4EFE6",
    colorInput: "#F7F3EC",
    colorInputForeground: "#141414",
    colorMuted: "#F4EFE6",
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
    cardBox: { width: "100%", boxShadow: "none", border: "1px solid #E2DBCF" },
  },
};

// Admin sign-in: no "Sign up" link. Owner logins are created in the Clerk dashboard.
export const clerkNoSignUpAppearance = {
  elements: { footerAction: { display: "none" } },
};
