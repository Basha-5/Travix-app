package com.travix.app.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.travix.app.ui.theme.*

@Composable
fun SafetyScreen(
    onDismiss: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(Color(0xFFC53030), Color(0xFFE53E3E))
                )
            ),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth(0.9f)
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text("🆘", fontSize = 72.sp)
            Text(
                "EMERGENCY SOS",
                fontSize = 28.sp,
                fontWeight = FontWeight.Black,
                color = Color.White,
                modifier = Modifier.padding(bottom = 8.dp)
            )
            Text(
                "Trusted contacts & Travix Safety Team have been notified with your live GPS location.",
                color = Color.White.copy(alpha = 0.9f),
                fontSize = 14.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(bottom = 32.dp)
            )

            // Vehicle Info Card
            Surface(
                color = Color.White.copy(alpha = 0.2f),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 24.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("EMERGENCY VEHICLE DATA", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.White.copy(alpha = 0.7f))
                    Spacer(modifier = Modifier.height(6.dp))
                    Text("🚗 Vehicle: KA-01-AB-1234 (Swift)", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                    Text("👤 Driver: Ramesh Kumar (⭐ 4.8)", color = Color.White, fontSize = 14.sp)
                    Text("📍 Location: Near Indiranagar 100ft Rd", color = Color.White, fontSize = 14.sp)
                }
            }

            // Call 112 Button
            Button(
                onClick = { /* Trigger emergency dialer */ },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp)
                    .padding(bottom = 12.dp),
                shape = RoundedCornerShape(100.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color.White)
            ) {
                Icon(Icons.Default.Call, contentDescription = null, tint = RedDanger)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Call 112 — Emergency Services", color = RedDanger, fontSize = 16.sp, fontWeight = FontWeight.Black)
            }

            // I'm Safe Now Button
            OutlinedButton(
                onClick = onDismiss,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(100.dp),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White),
                border = androidx.compose.foundation.BorderStroke(1.5.dp, Color.White.copy(alpha = 0.5f))
            ) {
                Text("I'm Safe Now", fontSize = 15.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}
