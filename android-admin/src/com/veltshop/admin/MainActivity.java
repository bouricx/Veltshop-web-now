package com.veltshop.admin;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Bundle;
import android.os.Environment;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.SslErrorHandler;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebStorage;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.PopupMenu;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

public final class MainActivity extends Activity {
    private static final int BG = 0xff171717, ACCENT = 0xffc4b5fd, MUTED = 0xffa3a3a3;
    private static final int PICK_FILE = 72;
    private final String[] titles = {"ภาพรวม", "สินค้า", "ลูกค้า", "แจ้งเตือน", "ระบบ"};
    private final LinearLayout[] tabButtons = new LinearLayout[5];
    private final TextView[] tabLabels = new TextView[5];
    private final NavIcon[] tabIcons = new NavIcon[5];
    private WebView web;
    private ProgressBar progress;
    private TextView subtitle;
    private LinearLayout errorPanel;
    private ValueCallback<Uri[]> fileCallback;
    private String desiredUrl = NavigationPolicy.tabUrl(0);
    private boolean waitingForLogin = false, destroyed = false;
    private int selected = 0;

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(BG);
        root.setFitsSystemWindows(true);
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            root.setOnApplyWindowInsetsListener((view, insets) -> {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return insets;
            });
        }
        root.addView(header(), new LinearLayout.LayoutParams(-1, dp(66)));
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setProgressTintList(android.content.res.ColorStateList.valueOf(ACCENT));
        root.addView(progress, new LinearLayout.LayoutParams(-1, dp(3)));
        FrameLayout content = new FrameLayout(this);
        web = new WebView(this);
        web.setBackgroundColor(BG);
        content.addView(web, new FrameLayout.LayoutParams(-1, -1));
        errorPanel = offlinePanel();
        content.addView(errorPanel, new FrameLayout.LayoutParams(-1, -1));
        root.addView(content, new LinearLayout.LayoutParams(-1, 0, 1));
        root.addView(navigation(), new LinearLayout.LayoutParams(-1, dp(68)));
        setContentView(root);
        configureWeb();
        if (saved != null) {
            selected = Math.max(0, Math.min(4, saved.getInt("tab", 0)));
            String target = saved.getString("desired");
            if (NavigationPolicy.isTrusted(target)) desiredUrl = target;
            waitingForLogin = saved.getBoolean("login", false);
        }
        highlight(selected);
        // Reload the authenticated website, never restore cached private form data.
        web.loadUrl(desiredUrl);
    }

    private View header() {
        LinearLayout row = new LinearLayout(this);
        row.setGravity(android.view.Gravity.CENTER_VERTICAL);
        row.setPadding(dp(16), 0, dp(8), 0);
        ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.brand_logo);
        logo.setScaleType(ImageView.ScaleType.FIT_CENTER);
        logo.setBackground(rounded(Color.WHITE, 12));
        row.addView(logo, new LinearLayout.LayoutParams(dp(44), dp(44)));
        LinearLayout names = new LinearLayout(this);
        names.setOrientation(LinearLayout.VERTICAL);
        names.setPadding(dp(12), 0, 0, 0);
        TextView title = text("VELTSHOP ADMIN", 15, Color.WHITE);
        title.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        names.addView(title);
        subtitle = text("เข้าสู่ระบบด้วยบัญชีแอดมินเดิม", 11, MUTED);
        names.addView(subtitle);
        row.addView(names, new LinearLayout.LayoutParams(0, -2, 1));
        Button more = new Button(this);
        more.setText("⋮"); more.setTextSize(23); more.setTextColor(Color.WHITE);
        more.setBackgroundColor(Color.TRANSPARENT);
        more.setContentDescription("ตัวเลือกแอป");
        more.setOnClickListener(this::showMenu);
        row.addView(more, new LinearLayout.LayoutParams(dp(48), dp(48)));
        return row;
    }

    private LinearLayout navigation() {
        LinearLayout bar = new LinearLayout(this);
        bar.setPadding(dp(6), dp(6), dp(6), dp(6));
        for (int index = 0; index < titles.length; index++) {
            final int tab = index;
            LinearLayout button = new LinearLayout(this);
            button.setOrientation(LinearLayout.VERTICAL);
            button.setGravity(android.view.Gravity.CENTER);
            button.setContentDescription(titles[index]);
            button.setFocusable(true);
            NavIcon icon = new NavIcon(index);
            TextView label = text(titles[index], 10, MUTED);
            button.addView(icon, new LinearLayout.LayoutParams(dp(23), dp(23)));
            button.addView(label);
            button.setOnClickListener(v -> openTab(tab));
            bar.addView(button, new LinearLayout.LayoutParams(0, -1, 1));
            tabButtons[index] = button; tabLabels[index] = label; tabIcons[index] = icon;
        }
        return bar;
    }

    private void openTab(int index) {
        selected = index; desiredUrl = NavigationPolicy.tabUrl(index);
        highlight(index); errorPanel.setVisibility(View.GONE); web.loadUrl(desiredUrl);
    }

    private void highlight(int index) {
        for (int i = 0; i < tabButtons.length; i++) {
            tabButtons[i].setBackground(rounded(i == index ? 0xff302741 : Color.TRANSPARENT, 12));
            tabButtons[i].setSelected(i == index);
            tabLabels[i].setTextColor(i == index ? ACCENT : MUTED);
            tabIcons[i].tint = i == index ? ACCENT : MUTED;
            tabIcons[i].invalidate();
        }
    }

    private void configureWeb() {
        WebView.setWebContentsDebuggingEnabled(false);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSafeBrowsingEnabled(true);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setTextZoom(100);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                String target = request.getUrl().toString();
                if (NavigationPolicy.isTrusted(target)) return false;
                if (request.hasGesture() && NavigationPolicy.canOpenExternal(target)) openBrowser(target);
                else toast("เปิดลิงก์ภายนอกจากเมนูเบราว์เซอร์ หรือเข้าสู่ระบบด้วยอีเมลของร้าน");
                return true;
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) {
                progress.setVisibility(View.VISIBLE); errorPanel.setVisibility(View.GONE);
            }
            @Override public void onPageFinished(WebView view, String url) {
                progress.setVisibility(View.GONE); CookieManager.getInstance().flush(); observeLocation(url);
            }
            @Override public void doUpdateVisitedHistory(WebView view, String url, boolean reload) { observeLocation(url); }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showOffline();
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame() && response.getStatusCode() >= 500) showOffline();
            }
            @Override public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.cancel(); showOffline();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int value) { progress.setProgress(value); }
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams parameters) {
                if (!NavigationPolicy.isTrusted(view.getUrl())) { callback.onReceiveValue(null); return true; }
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent choose = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                choose.addCategory(Intent.CATEGORY_OPENABLE); choose.setType("*/*");
                String[] accepted = parameters.getAcceptTypes();
                if (accepted != null && accepted.length > 0 && !accepted[0].isEmpty()) choose.putExtra(Intent.EXTRA_MIME_TYPES, accepted);
                choose.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, parameters.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                choose.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try { startActivityForResult(choose, PICK_FILE); }
                catch (ActivityNotFoundException error) { fileCallback.onReceiveValue(null); fileCallback = null; toast("ไม่พบแอปเลือกไฟล์"); }
                return true;
            }
        });
        web.setDownloadListener(this::download);
    }

    private void observeLocation(String value) {
        if (destroyed || !NavigationPolicy.isTrusted(value)) return;
        Uri uri = Uri.parse(value);
        if ("/login".equals(uri.getPath())) {
            waitingForLogin = true; subtitle.setText("เข้าสู่ระบบด้วยอีเมลและรหัสผ่านของเว็บ");
        } else if ("/shop".equals(uri.getPath()) && waitingForLogin) {
            waitingForLogin = false;
            web.post(() -> { if (!destroyed && NavigationPolicy.isTrusted(web.getUrl())) web.loadUrl(desiredUrl); });
        } else if ("/admin".equals(uri.getPath())) {
            subtitle.setText("หลังบ้านร้าน · สิทธิ์ตรวจจากบัญชีเว็บไซต์");
            String tab = uri.getQueryParameter("tab");
            for (int index = 0; index < NavigationPolicy.TABS.length; index++) {
                if (NavigationPolicy.TABS[index].equals(tab)) { selected = index; desiredUrl = NavigationPolicy.tabUrl(index); highlight(index); }
            }
        }
    }

    private LinearLayout offlinePanel() {
        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL); panel.setGravity(android.view.Gravity.CENTER);
        panel.setPadding(dp(24), dp(24), dp(24), dp(24)); panel.setBackgroundColor(BG);
        TextView title = text("ยังเชื่อมต่อร้านไม่ได้", 22, Color.WHITE);
        title.setTypeface(Typeface.DEFAULT, Typeface.BOLD); panel.addView(title);
        TextView help = text("ตรวจอินเทอร์เน็ต แล้วลองโหลดอีกครั้ง\nข้อมูลสินค้าและแชตจะโหลดจากเว็บเมื่อเชื่อมต่อได้", 14, MUTED);
        help.setGravity(android.view.Gravity.CENTER); help.setPadding(0, dp(16), 0, dp(16)); panel.addView(help);
        Button retry = new Button(this); retry.setText("ลองเชื่อมต่อใหม่");
        retry.setOnClickListener(v -> { panel.setVisibility(View.GONE); web.loadUrl(desiredUrl); }); panel.addView(retry);
        panel.setVisibility(View.GONE); return panel;
    }

    private void showOffline() { errorPanel.setVisibility(View.VISIBLE); progress.setVisibility(View.GONE); subtitle.setText("รอการเชื่อมต่อ · ไม่แสดงข้อมูลเก่าแทนข้อมูลจริง"); }

    private void showMenu(View anchor) {
        PopupMenu menu = new PopupMenu(this, anchor);
        menu.getMenu().add(0, 1, 0, "โหลดหน้าใหม่");
        menu.getMenu().add(0, 2, 1, "บัญชีและออกจากระบบ");
        menu.getMenu().add(0, 3, 2, "เปิดเว็บในเบราว์เซอร์");
        menu.getMenu().add(0, 4, 3, "ล้างข้อมูลการเข้าสู่ระบบในแอป");
        menu.getMenu().add(0, 5, 4, "เกี่ยวกับ Veltshop Admin");
        menu.setOnMenuItemClickListener(item -> {
            switch (item.getItemId()) {
                case 1: web.reload(); break;
                case 2: web.loadUrl(NavigationPolicy.ORIGIN + "/shop/profile"); break;
                case 3: openBrowser(NavigationPolicy.isTrusted(web.getUrl()) ? web.getUrl() : desiredUrl); break;
                case 4: new AlertDialog.Builder(this).setTitle("ล้างการเข้าสู่ระบบในแอป?")
                    .setMessage("แอปจะล้างคุกกี้และข้อมูลที่เก็บในเครื่อง ต้องเข้าสู่ระบบใหม่ ไม่ลบบัญชีหรือข้อมูลร้าน และไม่ออกจากระบบในอุปกรณ์อื่น")
                    .setNegativeButton("ยกเลิก", null).setPositiveButton("ล้างข้อมูล", (dialog, which) -> clearLocalSession()).show(); break;
                case 5: new AlertDialog.Builder(this).setTitle("Veltshop Admin 1.0.0")
                    .setMessage("แอป Android เชื่อมหลังบ้านเว็บ Veltshop ผ่าน HTTPS\n\nใช้บัญชีอีเมลและรหัสผ่านของเว็บเดิม บัญชีต้องมีสิทธิ์แอดมิน เมนูและการทำรายการตรวจสิทธิ์จากเซิร์ฟเวอร์\n\nสินค้า ลูกค้า แจ้งเตือน และสถานะระบบเป็นข้อมูลร้านจริง แชตลูกค้าเปิดจากออเดอร์ที่จัดส่งแล้ว\n\nแอปต้องเชื่อมต่ออินเทอร์เน็ต แจ้งเตือนแสดงขณะเปิดหน้าแจ้งเตือน ไม่ใช่ push เบื้องหลัง")
                    .setPositiveButton("เข้าใจแล้ว", null).show(); break;
            }
            return true;
        });
        menu.show();
    }

    private void clearLocalSession() {
        WebStorage.getInstance().deleteAllData(); web.clearCache(true); web.clearHistory();
        CookieManager.getInstance().removeAllCookies(done -> {
            if (!destroyed) { CookieManager.getInstance().flush(); waitingForLogin = false; web.loadUrl(NavigationPolicy.ORIGIN + "/login"); }
        });
    }

    private void openBrowser(String value) {
        if (!NavigationPolicy.canOpenExternal(value)) return;
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(value))); }
        catch (ActivityNotFoundException error) { toast("ไม่พบแอปเบราว์เซอร์"); }
    }

    private void download(String url, String agent, String disposition, String mime, long length) {
        if (!NavigationPolicy.isTrusted(web.getUrl()) || !NavigationPolicy.isTrusted(url)) {
            toast("ไฟล์นี้ให้ดาวน์โหลดจากเว็บในเบราว์เซอร์"); return;
        }
        new AlertDialog.Builder(this).setTitle("บันทึกไฟล์ลงเครื่อง?")
            .setMessage("ไฟล์จากหลังบ้านอาจมีข้อมูลร้าน จะบันทึกในโฟลเดอร์ดาวน์โหลด")
            .setNegativeButton("ยกเลิก", null).setPositiveButton("ดาวน์โหลด", (dialog, which) -> {
                try {
                    DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                    String cookies = CookieManager.getInstance().getCookie(url);
                    if (cookies != null) request.addRequestHeader("Cookie", cookies);
                    request.addRequestHeader("User-Agent", agent);
                    String name = URLUtil.guessFileName(url, disposition, mime).replaceAll("[^\\p{L}\\p{N}._ -]", "_");
                    request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
                    request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    ((DownloadManager) getSystemService(DOWNLOAD_SERVICE)).enqueue(request);
                    toast("เริ่มดาวน์โหลดแล้ว");
                } catch (Exception error) { toast("ดาวน์โหลดไม่ได้ กรุณาเปิดผ่านเบราว์เซอร์"); }
            }).show();
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request != PICK_FILE || fileCallback == null) return;
        Uri[] chosen = null;
        if (result == RESULT_OK && data != null) {
            if (data.getClipData() != null) {
                chosen = new Uri[data.getClipData().getItemCount()];
                for (int i = 0; i < chosen.length; i++) chosen[i] = data.getClipData().getItemAt(i).getUri();
            } else if (data.getData() != null) chosen = new Uri[]{data.getData()};
        }
        fileCallback.onReceiveValue(chosen); fileCallback = null;
    }

    @Override protected void onSaveInstanceState(Bundle state) {
        state.putInt("tab", selected); state.putString("desired", desiredUrl); state.putBoolean("login", waitingForLogin);
        super.onSaveInstanceState(state);
    }
    @Override protected void onPause() { web.onPause(); web.pauseTimers(); CookieManager.getInstance().flush(); super.onPause(); }
    @Override protected void onResume() { super.onResume(); if (web != null) { web.onResume(); web.resumeTimers(); } }
    @Override protected void onDestroy() {
        destroyed = true;
        if (fileCallback != null) { fileCallback.onReceiveValue(null); fileCallback = null; }
        web.stopLoading(); web.setWebChromeClient(null); web.destroy(); super.onDestroy();
    }
    @Override public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else new AlertDialog.Builder(this).setTitle("ปิด Veltshop Admin?").setNegativeButton("ใช้งานต่อ", null).setPositiveButton("ปิดแอป", (dialog, which) -> finish()).show();
    }

    private TextView text(String value, int size, int color) { TextView label = new TextView(this); label.setText(value); label.setTextSize(size); label.setTextColor(color); return label; }
    private int dp(float value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private GradientDrawable rounded(int color, int radius) { GradientDrawable shape = new GradientDrawable(); shape.setColor(color); shape.setCornerRadius(dp(radius)); return shape; }
    private void toast(String value) { Toast.makeText(this, value, Toast.LENGTH_LONG).show(); }

    private final class NavIcon extends View {
        final int kind; int tint = MUTED; final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        NavIcon(int kind) { super(MainActivity.this); this.kind = kind; setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO); }
        @Override protected void onDraw(Canvas canvas) {
            super.onDraw(canvas); canvas.save(); canvas.scale(getWidth()/24f, getHeight()/24f);
            paint.setColor(tint); paint.setStyle(Paint.Style.STROKE); paint.setStrokeWidth(1.8f); paint.setStrokeCap(Paint.Cap.ROUND); paint.setStrokeJoin(Paint.Join.ROUND);
            Path path = new Path();
            if (kind == 0) {
                canvas.drawRoundRect(3,3,10,10,1,1,paint); canvas.drawRoundRect(14,3,21,10,1,1,paint);
                canvas.drawRoundRect(3,14,10,21,1,1,paint); canvas.drawRoundRect(14,14,21,21,1,1,paint);
            } else if (kind == 1) {
                path.moveTo(3,7); path.lineTo(12,3); path.lineTo(21,7); path.lineTo(21,17); path.lineTo(12,21); path.lineTo(3,17); path.close(); canvas.drawPath(path,paint);
                canvas.drawLine(3,7,12,11,paint); canvas.drawLine(21,7,12,11,paint); canvas.drawLine(12,11,12,21,paint);
            } else if (kind == 2) {
                path.moveTo(4,4); path.lineTo(20,4); path.lineTo(20,16); path.lineTo(9,16); path.lineTo(4,21); path.close(); canvas.drawPath(path,paint);
                canvas.drawLine(8,9,16,9,paint); canvas.drawLine(8,12,13,12,paint);
            } else if (kind == 3) {
                path.moveTo(4,17); path.lineTo(6,14); path.lineTo(6,9); path.cubicTo(6,1,18,1,18,9); path.lineTo(18,14); path.lineTo(20,17); path.close(); canvas.drawPath(path,paint); canvas.drawArc(9,17,15,23,0,180,false,paint);
            } else {
                path.moveTo(2,12); path.lineTo(7,12); path.lineTo(10,4); path.lineTo(14,20); path.lineTo(17,12); path.lineTo(22,12); canvas.drawPath(path,paint);
            }
            canvas.restore();
        }
    }
}
