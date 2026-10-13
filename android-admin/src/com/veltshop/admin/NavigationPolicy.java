package com.veltshop.admin;

import java.net.URI;

/** No secrets and no privilege decisions here: the website authorizes every request. */
public final class NavigationPolicy {
    public static final String ORIGIN = "https://veltshop-website.vercel.app";
    public static final String[] TABS = {"dashboard", "products", "cart-requests", "notifications", "system"};
    private NavigationPolicy() {}

    public static boolean isTrusted(String value) {
        try {
            URI uri = new URI(value);
            return "https".equalsIgnoreCase(uri.getScheme())
                && "veltshop-website.vercel.app".equalsIgnoreCase(uri.getHost())
                && uri.getRawUserInfo() == null
                && (uri.getPort() == -1 || uri.getPort() == 443);
        } catch (Exception error) { return false; }
    }

    public static boolean canOpenExternal(String value) {
        try {
            URI uri = new URI(value);
            return "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null
                && uri.getRawUserInfo() == null && (uri.getPort() == -1 || uri.getPort() == 443);
        } catch (Exception error) { return false; }
    }

    public static String tabUrl(int index) {
        if (index < 0 || index >= TABS.length) throw new IllegalArgumentException("Unknown admin tab");
        return ORIGIN + "/admin?tab=" + TABS[index];
    }
}
