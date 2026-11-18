export const CONFIG = {
  API_BASE_URL:
    process.env.NEXT_PUBLIC_API_BASE_URL || "https://backend-6-hvkf.onrender.com/",
  STORAGE_KEYS: {
    ACCESS_TOKEN: "accessToken",
    REFRESH_TOKEN: "refreshToken",
  },
  ROUTES: {
    HOME: "/",
    LOGIN: "/login",
    REGISTER: "/register",
    DASHBOARD: "/dashboard",
    FOOD_ITEMS: "/dashboard/food-items",
    CATEGORIES: "/dashboard/categories",
    RESTAURANTS: "/dashboard/restaurants",
    ORDERS: "/dashboard/orders",
  },
  ENDPOINTS: {
    LOGIN: "/auth/login",
    REGISTER: "/auth/register",
    POSITIONS: "/positions",
    FOOD_ITEMS: "/food-items",
    CATEGORIES: "/categories",
    RESTAURANTS: "/restaurants",
    ORDERS: "/orders",
  },
} as const;