package com.travix.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.travix.app.ui.screens.AuthScreen
import com.travix.app.ui.screens.GroupRideScreen
import com.travix.app.ui.screens.HomeScreen
import com.travix.app.ui.screens.SafetyScreen
import com.travix.app.ui.theme.TravixTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            TravixTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    TravixApp()
                }
            }
        }
    }
}

@Composable
fun TravixApp() {
    val navController = rememberNavController()
    var isAuthenticated by remember { mutableStateOf(false) }

    NavHost(
        navController = navController,
        startDestination = if (isAuthenticated) "home" else "auth"
    ) {
        composable("auth") {
            AuthScreen(
                onLoginSuccess = { token ->
                    isAuthenticated = true
                    navController.navigate("home") {
                        popUpTo("auth") { inclusive = true }
                    }
                }
            )
        }
        composable("home") {
            HomeScreen(
                onGroupSelected = { navController.navigate("group_preview") },
                onSosClicked = { navController.navigate("safety") }
            )
        }
        composable("group_preview") {
            GroupRideScreen(
                onBack = { navController.popBackStack() },
                onJoinGroup = { navController.navigate("home") }
            )
        }
        composable("safety") {
            SafetyScreen(
                onDismiss = { navController.popBackStack() }
            )
        }
    }
}
