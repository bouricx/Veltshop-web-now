import com.veltshop.admin.NavigationPolicy;

public final class NavigationPolicyTest {
    private static void check(boolean value, String description) {
        if (!value) throw new AssertionError(description);
    }
    public static void main(String[] arguments) {
        String base = NavigationPolicy.ORIGIN;
        check(NavigationPolicy.isTrusted(base + "/admin?tab=products"), "Real admin URL");
        check(NavigationPolicy.isTrusted(base + ":443/admin"), "Explicit HTTPS port");
        check(NavigationPolicy.isTrusted("HTTPS://VELTSHOP-WEBSITE.VERCEL.APP/admin"), "Case-insensitive origin");
        for (String rejected : new String[]{null, "", "javascript:alert(1)", "file:///sdcard/test.html",
            "content://private/data", "intent://test", "http://veltshop-website.vercel.app/admin",
            "https://veltshop-website.vercel.app.evil.test/admin", "https://evil.test/?next="+base,
            "https://veltshop-website.vercel.app@evil.test/", "https://evil.test@veltshop-website.vercel.app/",
            base+":444/admin", "https://veltshop-website.vercel.app\\@evil.test/"}) {
            check(!NavigationPolicy.isTrusted(rejected), "Reject unsafe/internal navigation: " + rejected);
        }
        check(NavigationPolicy.canOpenExternal("https://www.facebook.com/Veltshop/"), "User-chosen external HTTPS");
        check(!NavigationPolicy.canOpenExternal("javascript:alert(1)"), "No script external intents");
        check(!NavigationPolicy.canOpenExternal("https://user:secret@example.test"), "No userinfo external links");
        String[] tabs = {"dashboard", "products", "cart-requests", "notifications", "system"};
        for (int index=0; index<tabs.length; index++) {
            check(NavigationPolicy.tabUrl(index).equals(base + "/admin?tab=" + tabs[index]), "Correct real admin tab");
        }
        boolean invalid = false;
        try { NavigationPolicy.tabUrl(99); } catch (IllegalArgumentException expected) { invalid = true; }
        check(invalid, "Invalid tab cannot alter the app origin");
        System.out.println("Passed navigation, origin isolation and admin route tests.");
    }
}
