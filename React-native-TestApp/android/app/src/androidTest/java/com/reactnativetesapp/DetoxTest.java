package com.reactnativetesapp;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.rule.ActivityTestRule;

import com.wix.detox.Detox;
import com.wix.detox.config.DetoxConfig;

import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class DetoxTest {
  @Rule
  public ActivityTestRule<MainActivity> activityRule = new ActivityTestRule<>(MainActivity.class, false, false);

  @Test
  public void runDetoxTests() {
    DetoxConfig detoxConfig = new DetoxConfig();
    detoxConfig.idlePolicyConfig.masterTimeoutSec = 90;
    detoxConfig.idlePolicyConfig.idleResourceTimeoutSec = 60;
    detoxConfig.rnContextLoadTimeoutSec = BuildConfig.DEBUG ? 300 : 120;

    Detox.runTests(activityRule, detoxConfig);
  }
}
