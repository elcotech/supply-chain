package et.escon.supplychain;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Screenshots and screen recordings are allowed again (v6.0).
        // The old FLAG_SECURE call was removed deliberately so buyers can
        // capture prices, proformas and account details when they need to.
    }
}
