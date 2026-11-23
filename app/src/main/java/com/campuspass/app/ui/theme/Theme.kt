package com.campuspass.app.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

private val CampusLightColorScheme = lightColorScheme(
    primary = IndigoPrimary,
    onPrimary = Color.White,
    primaryContainer = IndigoSoft,
    onPrimaryContainer = IndigoDeep,
    secondary = AmberVibrant,
    onSecondary = SlateTextPrimary,
    secondaryContainer = AmberSoft,
    onSecondaryContainer = AmberDark,
    tertiary = EmeraldVerified,
    onTertiary = Color.White,
    tertiaryContainer = EmeraldSoft,
    onTertiaryContainer = EmeraldVerified,
    background = SlateCanvas,
    onBackground = SlateTextPrimary,
    surface = SlateCard,
    onSurface = SlateTextPrimary,
    surfaceVariant = SlateMuted,
    onSurfaceVariant = SlateTextSecondary,
    outline = SlateBorder,
    error = RoseAlert,
    onError = Color.White,
    errorContainer = RoseSoft,
    onErrorContainer = RoseAlert
)

val CampusShapes = Shapes(
    small = RoundedCornerShape(12.dp),
    medium = RoundedCornerShape(18.dp),
    large = RoundedCornerShape(24.dp),
    extraLarge = RoundedCornerShape(28.dp)
)

@Composable
fun CampusPassTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = CampusLightColorScheme,
        typography = AppTypography,
        shapes = CampusShapes,
        content = content
    )
}
