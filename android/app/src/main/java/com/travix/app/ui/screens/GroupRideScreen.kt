package com.travix.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.travix.app.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GroupRideScreen(
    onBack: () -> Unit,
    onJoinGroup: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("👥 Group Ride Preview", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .padding(16.dp)
        ) {
            // Privacy Banner
            Surface(
                color = Color(0xFFE6FFFA),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 16.dp)
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.Shield, contentDescription = null, tint = TealPrimary)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        "Strict Privacy: Names & details remain hidden until ride starts.",
                        fontSize = 12.sp,
                        color = Color(0xFF234E52)
                    )
                }
            }

            // Driver Card
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 16.dp),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(2.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("DRIVER DETAILS", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = TextMuted)
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("👩‍💼", fontSize = 28.sp)
                            Spacer(modifier = Modifier.width(8.dp))
                            Column {
                                Text("Female Driver", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                Text("White Maruti Swift", fontSize = 12.sp, color = TextMuted)
                            }
                        }
                        Text("⭐ 4.9", fontWeight = FontWeight.Bold, color = AmberAccent)
                    }
                }
            }

            // Riders Composition Card
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 20.dp),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(2.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("CURRENT RIDERS (3/5 SEATS)", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = TextMuted)
                    Spacer(modifier = Modifier.height(12.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceAround
                    ) {
                        CompositionBadge(emoji = "👩", count = "1 Female", color = Color(0xFFFCE7F3))
                        CompositionBadge(emoji = "👨", count = "2 Male", color = Color(0xFFE6F0FF))
                        CompositionBadge(emoji = "🧑", count = "0 Other", color = BackgroundLight)
                    }
                }
            }

            // Savings summary & CTA
            Spacer(modifier = Modifier.weight(1f))
            Surface(
                color = BackgroundLight,
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 16.dp)
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text("Group Fare", fontSize = 12.sp, color = TextMuted)
                        Text("₹85", fontSize = 24.sp, fontWeight = FontWeight.Black, color = TealPrimary)
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text("Normal: ₹140", fontSize = 12.sp, color = TextMuted)
                        Text("Save ₹55 (40%)", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = GreenSuccess)
                    }
                }
            }

            Button(
                onClick = onJoinGroup,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(100.dp),
                colors = ButtonDefaults.buttonColors(containerColor = TealPrimary)
            ) {
                Text("✅ Confirm & Join Group", fontSize = 16.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
fun CompositionBadge(emoji: String, count: String, color: Color) {
    Surface(
        color = color,
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(emoji, fontSize = 24.sp)
            Text(count, fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
    }
}
