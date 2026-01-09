// WordCrack Theme Colors - Matching the playful logo style

export const colors = {
  // Primary colors from logo
  primary: {
    blue: "#4A90D9",        // Main blue (magnifying glass, CRACK text)
    darkBlue: "#2D5A8A",    // Dark blue outline
    yellow: "#FFD93D",      // WORD text yellow
    orange: "#FF9F43",      // Orange letter tile
    green: "#26DE81",       // Green letter tile
    red: "#FC5C65",         // Red/pink letter tile
    lightBlue: "#74C0FC",   // Light blue accents
    cyan: "#45AAF2",        // Cyan blue tile
  },

  // Background colors
  background: {
    main: "#F0F8FF",        // Light blue-white background
    card: "#FFFFFF",        // White cards
    dark: "#2D5A8A",        // Dark sections
    gradient: {
      start: "#4A90D9",
      end: "#2D5A8A",
    },
  },

  // Text colors
  text: {
    primary: "#2D3436",     // Dark gray text
    secondary: "#636E72",   // Medium gray
    light: "#FFFFFF",       // White text
    muted: "#B2BEC3",       // Muted gray
  },

  // Letter tile colors (rotating for columns)
  tiles: [
    "#45AAF2",  // Blue
    "#FF9F43",  // Orange
    "#26DE81",  // Green
    "#FC5C65",  // Red/pink
    "#A55EEA",  // Purple
    "#FFD93D",  // Yellow
  ],

  // UI element colors
  ui: {
    success: "#26DE81",
    warning: "#FFD93D",
    error: "#FC5C65",
    info: "#45AAF2",
    border: "#DFE6E9",
    shadow: "rgba(45, 90, 138, 0.15)",
  },

  // Button colors
  button: {
    primary: "#4A90D9",
    primaryPressed: "#3A7BC8",
    secondary: "#FFD93D",
    secondaryPressed: "#F0C830",
    hint: "#FF9F43",
    hintPressed: "#E8903D",
    submit: "#26DE81",
    submitPressed: "#20C870",
    danger: "#FC5C65",
    dangerPressed: "#E54F58",
  },
};

export const shadows = {
  small: {
    shadowColor: colors.ui.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: colors.ui.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: colors.ui.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 6,
  },
};

export const borderRadius = {
  small: 8,
  medium: 12,
  large: 16,
  xl: 20,
  round: 9999,
};
