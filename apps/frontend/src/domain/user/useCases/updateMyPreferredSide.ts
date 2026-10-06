import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Side } from "@domain/enrollment/types";
import { userService } from "@domain/user/service";
import { queryKeys } from "@domain/queryKeys";
import { toActionError } from "@utils";

async function updateMyPreferredSide(preferredSide: Side) {
  try {
    return await userService.updateMyPreferredSide(preferredSide);
  } catch (err) {
    throw toActionError(err, "Erro ao salvar o lado preferido");
  }
}

// Só muda o `me`: o lado vale pras próximas inscrições, as já feitas
// continuam no lado em que foram feitas.
export function useUpdateMyPreferredSide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateMyPreferredSide,
    onSuccess: me => queryClient.setQueryData(queryKeys.auth.me, me),
  });
}
