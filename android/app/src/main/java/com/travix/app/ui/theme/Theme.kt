package com.travix.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val TealPrimary = Color(0xFF1A7A6E)
val TealPrimaryDark = Color(0xFF145F57)
val TealLight = Color(0xFF2BA898)
val AmberAccent = Color(0xFFF5A623)
val RedDanger = Color(0xFFE53E3E)
val GreenSuccess = Color(0xFF38A169)
val BackgroundLight = Color(0xFFF0F4F8)
val SurfaceLight = Color(0xFFFFFFFF)
val TextPrimary = Color(0xFF1A202C)
val TextMuted = Color(0xFF718096)

private val LightColorScheme = lightColorScheme(
    primary = TealPrimary,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFE6FFFA),
    onPrimaryContainer = Color(0xFF234E52),
    secondary = AmberAccent,
    onSecondary = Color.White,
    error = RedDanger,
    onError = Color.White,
    background = BackgroundLight,
    onBackground = TextPrimary,
    surface = SurfaceLight,
    onSurface = TextPrimary
)

@Composable
fun TravixTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = LightColorScheme,
        content = content
    )
}
