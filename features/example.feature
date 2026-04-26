Feature: Playwright example
  BDD version of the sample `tests/example.spec.ts` flow.

  Scenario: Page has title
    Given I open the Playwright home page
    Then the page title should contain "Playwright"

  Scenario: Get started link
    Given I open the Playwright home page
    When I follow the "Get started" link
    Then I should see heading "Installation"
