export function initWelcome({ roleButtons, onRoleSelect }) {
  roleButtons.forEach((button) => {
    button.addEventListener('click', () => onRoleSelect(button.dataset.roleSelect));
  });
}
