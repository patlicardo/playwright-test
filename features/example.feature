Feature: Playwright example
  BDD version of the sample `tests/example.spec.ts` flow.
  # Tag each scenario with the Jira *Test* issue key so Xray + CI can run one case (e.g. @PROJ-123).

  @DEMO-101
  Scenario: Page has title
    Given I open the Playwright home page
    Then the page title should contain "Playwright"

  @DEMO-102
  Scenario: Get started link
    Given I open the Playwright home page
    When I follow the "Get started" link
    Then I should see heading "Installation"
