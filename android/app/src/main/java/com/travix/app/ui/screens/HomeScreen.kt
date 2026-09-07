package com.travix.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Search
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

@Composable
fun HomeScreen(
    onGroupSelected: () -> Unit,
    onSosClicked: () -> Unit
) {
    var searchDestination by remember { mutableStateOf("") }

    Box(modifier = Modifier.fillMaxSize()) {
        // Map Container Placeholder
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFF0F2130)),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("🗺️ Live Map Tracking", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                Text("GPS Active • 5 Nearby Drivers", color = TealLight, fontSize = 13.sp)
            }
        }

        // Top Header Pill
        Surface(
            modifier = Modifier
                .padding(top = 48.dp, start = 16.dp, end = 16.dp)
                .fillMaxWidth(),
            shape = RoundedCornerShape(100.dp),
            color = Color.White.copy(alpha = 0.9f),
            shadowElevation = 8.dp
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.LocationOn, contentDescription = null, tint = TealPrimary)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Bangalore, KA", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                }
                Surface(
                    color = RedDanger,
                    shape = RoundedCornerShape(100.dp),
                    modifier = Modifier.clickable { onSosClicked() }
                ) {
                    Text(
                        "🆘 SOS",
                        color = Color.White,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Black,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                    )
                }
            }
        }

        // Bottom Booking Sheet
        Surface(
            modifier = Modifier.align(Alignment.BottomCenter),
            shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
            color = Color.White,
            shadowElevation = 16.dp
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp)
            ) {
                Text("Where to?", fontSize = 20.sp, fontWeight = FontWeight.Black)
                Text("Book a safe ride in seconds", fontSize = 13.sp, color = TextMuted, modifier = Modifier.padding(bottom = 16.dp))

                // Search Box
                OutlinedTextField(
                    value = searchDestination,
                    onValueChange = { searchDestination = it },
                    placeholder = { Text("Search destination...") },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = TextMuted) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 16.dp),
                    shape = RoundedCornerShape(12.dp)
                )

                // Ride Type Row
                Text("Select Ride Type", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = TextMuted, modifier = Modifier.padding(bottom = 8.dp))
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.padding(bottom = 16.dp)
                ) {
                    items(
                        listOf(
                            Triple("🛺 Auto", "₹85", "4 min"),
                            Triple("🏍️ Bike", "₹55", "3 min"),
                            Triple("🚗 Go", "₹140", "6 min"),
                            Triple("👥 Group", "₹55", "7 min")
                        )
                    ) { (type, price, eta) ->
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = if (type.contains("Group")) Color(0xFFE6FFFA) else BackgroundLight,
                            border = if (type.contains("Group")) androidx.compose.foundation.BorderStroke(1.5.dp, TealPrimary) else null,
                            modifier = Modifier.clickable {
                                if (type.contains("Group")) onGroupSelected()
                            }
                        ) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                Text(type, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                Text(price, fontWeight = FontWeight.Black, fontSize = 15.sp, color = TealPrimary)
                                Text(eta, fontSize = 11.sp, color = TextMuted)
                            }
                        }
                    }
                }

                // Group Match Banner
                Surface(
                    color = TealPrimary,
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onGroupSelected() }
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Group, contentDescription = null, tint = Color.White)
                            Spacer(modifier = Modifier.width(12.dp))
                            Column {
                                Text("Group Ride Matching", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                Text("Share route & see gender composition", color = Color.White.copy(alpha = 0.8f), fontSize = 12.sp)
                            }
                        }
                        Text("Save 40%", color = AmberAccent, fontWeight = FontWeight.Black, fontSize = 13.sp)
                    }
                }
            }
        }
    }
}
