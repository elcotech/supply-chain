package et.escon.supplychain;

import android.os.Bundle;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Screenshot / screen-recording protection.
        // FLAG_SECURE keeps the app's contents (prices, invoices, account data)
        // out of the screenshot gallery, the recents-screen preview and most
        // screen recorders. It applies to every page of the Android app; the
        // PWA in a normal browser cannot block screenshots.
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        );
    }
}
