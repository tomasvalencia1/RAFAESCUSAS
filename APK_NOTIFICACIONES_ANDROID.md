# Notificaciones FCM para la APK RafaConecta

La parte web y el envío gratuito ya están implementados. Para que Android reciba avisos cuando la aplicación esté cerrada, integra este archivo en el **proyecto Android original** con el que se genera la APK. No es posible añadir de forma fiable este código sin ese proyecto fuente.

## Lo indispensable para ti

1. En Firebase Console → Project settings → Your apps, crea o selecciona la app Android con el mismo `applicationId` de tu APK. Descarga `google-services.json` y colócalo en `app/google-services.json`.
2. Añade Firebase Messaging a la app Android y pega la clase Kotlin de abajo. Asegúrate de que el canal se llame `rafa_importante`, como el enviador del repositorio.
3. En Android 13 o superior, declara y solicita `POST_NOTIFICATIONS`.
4. Haz que tu WebView llame a `window.registerAndroidFcmToken(token)` cada vez que Firebase renueve el token. El código incluido lo hace automáticamente desde JavaScript cuando se expone el puente `AndroidFCM`.

## Gradle (módulo `app`)

```kotlin
plugins {
    id("com.google.gms.google-services")
}

dependencies {
    implementation(platform("com.google.firebase:firebase-bom:33.5.1"))
    implementation("com.google.firebase:firebase-messaging")
}
```

En el `build.gradle` de nivel proyecto, añade el plugin de Google Services si aún no existe:

```kotlin
plugins {
    id("com.google.gms.google-services") version "4.4.2" apply false
}
```

## AndroidManifest.xml

```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

<application ...>
    <service
        android:name=".RafaFirebaseMessagingService"
        android:exported="false">
        <intent-filter>
            <action android:name="com.google.firebase.MESSAGING_EVENT" />
        </intent-filter>
    </service>
</application>
```

## Servicio Kotlin

Adapta el `package` al de tu aplicación. Este servicio crea el canal, muestra las notificaciones y entrega cada token al WebView mediante el método ya existente `registerAndroidFcmToken`.

```kotlin
package tu.paquete.android

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class RafaFirebaseMessagingService : FirebaseMessagingService() {
    companion object {
        const val CHANNEL_ID = "rafa_importante"
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        (application as? TuAplicacion)?.deliverFcmTokenToWebView(token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        createChannel()
        val title = message.notification?.title ?: "RafaConecta"
        val body = message.notification?.body ?: "Tienes una notificación nueva."
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()
        getSystemService(NotificationManager::class.java).notify(System.currentTimeMillis().toInt(), notification)
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "Avisos importantes", NotificationManager.IMPORTANCE_HIGH)
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }
}
```

## Puente de la WebView

Tu clase que configura la WebView debe exponer estas funciones con el nombre `AndroidFCM`:

```kotlin
webView.addJavascriptInterface(object {
    @android.webkit.JavascriptInterface
    fun getFcmToken(): String = FirebaseMessaging.getInstance().token.result ?: ""

    @android.webkit.JavascriptInterface
    fun requestNotificationPermission() {
        // Desde la Activity solicita POST_NOTIFICATIONS en Android 13+.
    }
}, "AndroidFCM")
```

Cuando obtengas o renueves un token, ejecuta en la WebView:

```kotlin
webView.evaluateJavascript("window.registerAndroidFcmToken(${org.json.JSONObject.quote(token)});", null)
```

`ic_stat_notification` debe ser un icono monocromático pequeño en `res/drawable`. Si no existe, crea uno antes de compilar.
