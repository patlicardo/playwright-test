Feature: Playwright failing example
  A dedicated failing scenario for PT-6.

  Scenario: Intentional failure for Xray validation
    Given I open the Playwright home page
    Then I intentionally fail PT-6
